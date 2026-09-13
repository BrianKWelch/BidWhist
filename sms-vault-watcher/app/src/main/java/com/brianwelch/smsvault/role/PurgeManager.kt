package com.brianwelch.smsvault.role

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.provider.Telephony
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.util.PhoneMatch

/**
 * Section 7: the deletion path.
 *
 * Deletion from content://sms and content://mms only succeeds while this app
 * holds the SMS role. The flow is strictly user-initiated:
 *
 *   1. Capture the current default SMS package and store it.
 *   2. UI shows a confirmation that RCS is interrupted for the duration.
 *   3. Request ROLE_SMS.
 *   4. On grant, delete each pending provider row, checking the returned count.
 *   5. Mark only the rows that actually deleted.
 *   6. Send the user to default-apps settings to restore their app.
 *   7. On next launch, verify we are no longer default.
 *
 * The role cannot be handed back programmatically, so step 6 is a manual hand-off.
 */
object PurgeManager {

    const val RC_SMS_ROLE = 7001

    private const val PREFS = "purge_state"
    private const val KEY_PREVIOUS_DEFAULT = "previous_default_sms"

    /** Step 1 + 3: remember the current default, return the role-request intent. */
    fun beginRoleRequest(activity: Activity): Intent {
        val previous = Telephony.Sms.getDefaultSmsPackage(activity)
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_PREVIOUS_DEFAULT, previous).apply()
        val rm = activity.getSystemService(RoleManager::class.java)
        return rm.createRequestRoleIntent(RoleManager.ROLE_SMS)
    }

    fun isHoldingRole(context: Context): Boolean =
        context.packageName == Telephony.Sms.getDefaultSmsPackage(context)

    fun previousDefaultPackage(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_PREVIOUS_DEFAULT, null)

    /**
     * Step 4-5: iterate pending rows and delete from the provider. A returned
     * count of 0 means the delete silently failed — we record it and do NOT mark
     * the row deleted (spec: surface it to the user).
     */
    suspend fun runSweep(context: Context): SweepResult {
        if (!isHoldingRole(context)) return SweepResult(0, emptyList(), roleNotHeld = true)

        val repo = VaultRepository.get(context)
        val pending = repo.pendingProviderDeletes()
        var deleted = 0
        val failures = ArrayList<Failure>()

        for (msg in pending) {
            val rowId = msg.provider_row_id ?: continue
            val uri = if (msg.source == "mms") Telephony.Mms.CONTENT_URI else Telephony.Sms.CONTENT_URI
            val count = try {
                context.contentResolver.delete(uri, "_id = ?", arrayOf(rowId.toString()))
            } catch (e: Exception) {
                failures += Failure(msg.id, rowId, msg.source, e.message ?: "exception")
                continue
            }
            if (count > 0) {
                repo.markProviderDeleted(msg.id)
                deleted++
            } else {
                // Silent failure: row not found or write refused.
                failures += Failure(msg.id, rowId, msg.source, "delete returned 0")
            }
        }
        return SweepResult(deleted, failures)
    }

    /** Step 6: hand the role back. There is no programmatic return path. */
    fun restoreDefaultIntent(): Intent =
        Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)

    /**
     * One-time historical import (spec 7). Requires the role to be held (so we can
     * subsequently delete). Scans content://sms and content://mms for every vault
     * number, copies matches into the vault, then leaves them for the sweep to
     * delete (or deletes inline if [deleteAfter] is true).
     */
    suspend fun historicalImport(context: Context, deleteAfter: Boolean): ImportResult {
        val repo = VaultRepository.get(context)
        val numbers = repo.storedNumbers()
        if (numbers.isEmpty()) return ImportResult(0, 0)

        var importedSms = 0
        var importedMms = 0

        // ---- SMS inbox ----
        context.contentResolver.query(
            Telephony.Sms.Inbox.CONTENT_URI,
            arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY,
                Telephony.Sms.DATE, Telephony.Sms.SUBSCRIPTION_ID),
            null, null, "${Telephony.Sms.DATE} ASC"
        )?.use { c ->
            val idCol = c.getColumnIndexOrThrow(Telephony.Sms._ID)
            val addrCol = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
            val bodyCol = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
            val dateCol = c.getColumnIndexOrThrow(Telephony.Sms.DATE)
            val subCol = c.getColumnIndex(Telephony.Sms.SUBSCRIPTION_ID)
            while (c.moveToNext()) {
                val addr = c.getString(addrCol)
                if (!PhoneMatch.matchesAny(addr, numbers)) continue
                val stored = repo.storeMessage(
                    senderRaw = addr ?: "",
                    body = c.getString(bodyCol),
                    receivedAt = c.getLong(dateCol),
                    subscriptionId = if (subCol >= 0) c.getInt(subCol) else -1,
                    source = "sms",
                    providerRowId = c.getLong(idCol),
                    attachments = emptyList()
                )
                if (stored != null) importedSms++
            }
        }

        // ---- MMS (metadata; parts read via the observer's part reader path) ----
        // For brevity of the historical path we reuse a lightweight part scan.
        val importer = HistoricalMmsImporter(context, repo, numbers)
        importedMms = importer.run()

        if (deleteAfter && isHoldingRole(context)) {
            runSweep(context)
        }
        return ImportResult(importedSms, importedMms)
    }

    data class Failure(val messageId: Long, val providerRowId: Long, val source: String, val reason: String)
    data class SweepResult(
        val deletedCount: Int,
        val failures: List<Failure>,
        val roleNotHeld: Boolean = false
    )
    data class ImportResult(val importedSms: Int, val importedMms: Int)
}
