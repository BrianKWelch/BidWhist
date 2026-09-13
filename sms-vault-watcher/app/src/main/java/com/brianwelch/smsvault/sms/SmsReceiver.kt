package com.brianwelch.smsvault.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.util.PhoneMatch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Section 4.1: real-time SMS capture.
 *
 * SMS_RECEIVED is delivered to every holder of RECEIVE_SMS, so a non-default app
 * receives it. We reassemble multipart bodies, read the subscription id for dual
 * SIM, and hand the message to the repository.
 *
 * We do NOT abortBroadcast(): that is a default-app-only capability and would
 * break the real messaging app. The original SMS is removed later, on demand,
 * through the purge sweep — not here.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        // Concatenate multipart bodies (acceptance test 2). All parts share a
        // sender and timestamp; the body is the concatenation in arrival order.
        val sender = messages.first().displayOriginatingAddress ?: messages.first().originatingAddress
        val body = buildString { messages.forEach { append(it.displayMessageBody ?: it.messageBody ?: "") } }
        val receivedAt = messages.first().timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()

        // Dual SIM: subscription id lives in the intent extras.
        val subscriptionId = intent.getIntExtra("subscription", -1)

        val last10 = PhoneMatch.last10(sender)

        // Asynchronous work outside the receiver's synchronous window.
        val pending = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repo = VaultRepository.get(appContext)
                if (!repo.isWatched(sender)) return@launch

                // Populate the race-condition bridge immediately so the
                // notification listener can suppress even before the DB write.
                RecentSenders.mark(last10)

                repo.storeMessage(
                    senderRaw = sender ?: "",
                    body = body,
                    receivedAt = receivedAt,
                    subscriptionId = subscriptionId,
                    source = "sms",
                    providerRowId = resolveProviderRowId(appContext, sender, body, receivedAt),
                    attachments = emptyList()
                )
            } catch (_: Exception) {
                // Never crash the broadcast; a missed capture is recoverable via
                // the historical import.
            } finally {
                pending.finish()
            }
        }
    }

    /**
     * The broadcast carries no content-provider _id. To make the purge sweep able
     * to target this exact row later, look it up in content://sms/inbox by
     * address + body + approximate date. Returns null if not yet visible (the
     * default app may not have written it yet); the historical import can fill
     * the gap later.
     */
    private fun resolveProviderRowId(context: Context, sender: String?, body: String, receivedAt: Long): Long? {
        if (sender == null) return null
        return try {
            val uri = Telephony.Sms.Inbox.CONTENT_URI
            val projection = arrayOf(Telephony.Sms._ID, Telephony.Sms.DATE)
            // 15s window either side to tolerate clock/round differences.
            val selection = "${Telephony.Sms.ADDRESS} = ? AND ${Telephony.Sms.BODY} = ? AND " +
                "${Telephony.Sms.DATE} BETWEEN ? AND ?"
            val args = arrayOf(
                sender,
                body,
                (receivedAt - 15_000).toString(),
                (receivedAt + 15_000).toString()
            )
            context.contentResolver.query(
                uri, projection, selection, args, "${Telephony.Sms.DATE} DESC"
            )?.use { c -> if (c.moveToFirst()) c.getLong(0) else null }
        } catch (_: Exception) {
            null
        }
    }
}
