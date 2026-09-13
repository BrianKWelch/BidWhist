package com.brianwelch.smsvault.mms

import android.content.Context
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.notify.VaultAlerts
import com.brianwelch.smsvault.sms.RecentSenders
import com.brianwelch.smsvault.util.PhoneMatch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Section 4.2: MMS capture by polling.
 *
 * A non-default app cannot receive WAP_PUSH_DELIVER or call
 * downloadMultimediaMessage(). Instead we observe content://mms-sms/ and, on any
 * change, read content://mms rows newer than the last processed _id. This runs a
 * few seconds behind the default app, which is the accepted trade-off.
 */
class MmsObserver(
    private val context: Context,
    handler: Handler = Handler(Looper.getMainLooper())
) : ContentObserver(handler) {

    private val repo = VaultRepository.get(context)
    private val scope = CoroutineScope(Dispatchers.IO)
    private val sweepLock = Mutex()

    fun register() {
        context.contentResolver.registerContentObserver(
            Uri.parse("content://mms-sms/"),
            /* notifyForDescendants = */ true,
            this
        )
        // Run one sweep at startup to catch anything that arrived while dead.
        onChange(false)
    }

    fun unregister() {
        try { context.contentResolver.unregisterContentObserver(this) } catch (_: Exception) {}
    }

    override fun onChange(selfChange: Boolean) = onChange(selfChange, null)

    override fun onChange(selfChange: Boolean, uri: Uri?) {
        scope.launch {
            // Serialize sweeps; the observer can fire in bursts.
            sweepLock.withLock { runCatching { sweep() } }
        }
    }

    private suspend fun sweep() {
        val stored = repo.storedNumbers()
        if (stored.isEmpty()) return

        val lastId = repo.lastProcessedMmsId()
        var highestSeen = lastId

        val mmsUri = Uri.parse("content://mms")
        val projection = arrayOf("_id", "date", "sub_id", "m_type")
        // date in content://mms is in SECONDS.
        context.contentResolver.query(
            mmsUri,
            projection,
            "_id > ?",
            arrayOf(lastId.toString()),
            "_id ASC"
        )?.use { c ->
            val idCol = c.getColumnIndexOrThrow("_id")
            val dateCol = c.getColumnIndex("date")
            val subCol = c.getColumnIndex("sub_id")
            while (c.moveToNext()) {
                val mmsId = c.getLong(idCol)
                highestSeen = maxOf(highestSeen, mmsId)
                val sender = senderOf(mmsId) ?: continue
                if (!PhoneMatch.matchesAny(sender, stored)) continue

                RecentSenders.mark(PhoneMatch.last10(sender))

                val receivedAt = if (dateCol >= 0) c.getLong(dateCol) * 1000L else System.currentTimeMillis()
                val subId = if (subCol >= 0) c.getInt(subCol) else -1
                val (text, media) = readParts(mmsId)

                val newId = repo.storeMessage(
                    senderRaw = sender,
                    body = text,
                    receivedAt = receivedAt,
                    subscriptionId = subId,
                    source = "mms",
                    providerRowId = mmsId,
                    attachments = media
                )

                // Owner-authored arrival alert: shows the number's label only.
                if (newId != null) {
                    VaultAlerts.notify(context, repo.labelFor(sender))
                }
            }
        }

        if (highestSeen > lastId) repo.setLastProcessedMmsId(highestSeen)
    }

    /**
     * Resolve the sender by querying content://mms/<id>/addr for type = 137
     * (PDU_HEADERS_FROM).
     */
    private fun senderOf(mmsId: Long): String? {
        val addrUri = Uri.parse("content://mms/$mmsId/addr")
        return context.contentResolver.query(
            addrUri,
            arrayOf("address", "type"),
            "type = ?",
            arrayOf(FROM_TYPE.toString()),
            null
        )?.use { c ->
            if (c.moveToFirst()) c.getString(c.getColumnIndexOrThrow("address")) else null
        }
    }

    /**
     * Read the parts for one MMS. text/plain becomes the body; image and video
     * parts are streamed straight into EncryptedFile via the repository — the
     * stream is opened here and consumed downstream, never fully buffered.
     */
    private fun readParts(mmsId: Long): Pair<String?, List<VaultRepository.PendingAttachment>> {
        val partUri = Uri.parse("content://mms/part")
        val text = StringBuilder()
        val media = ArrayList<VaultRepository.PendingAttachment>()

        context.contentResolver.query(
            partUri,
            arrayOf("_id", "ct", "text", "_data"),
            "mid = ?",
            arrayOf(mmsId.toString()),
            null
        )?.use { c ->
            val idCol = c.getColumnIndexOrThrow("_id")
            val ctCol = c.getColumnIndexOrThrow("ct")
            val textCol = c.getColumnIndexOrThrow("text")
            while (c.moveToNext()) {
                val partId = c.getLong(idCol)
                val ct = c.getString(ctCol) ?: continue
                when {
                    ct == "text/plain" -> {
                        val inline = c.getString(textCol)
                        if (!inline.isNullOrEmpty()) {
                            text.append(inline)
                        } else {
                            readPartText(partId)?.let { text.append(it) }
                        }
                    }
                    ct.startsWith("image/") || ct.startsWith("video/") -> {
                        val stream = context.contentResolver.openInputStream(
                            Uri.parse("content://mms/part/$partId")
                        )
                        if (stream != null) {
                            media += VaultRepository.PendingAttachment(ct, stream)
                        }
                    }
                }
            }
        }
        return (if (text.isEmpty()) null else text.toString()) to media
    }

    private fun readPartText(partId: Long): String? =
        try {
            context.contentResolver.openInputStream(Uri.parse("content://mms/part/$partId"))
                ?.use { it.readBytes().toString(Charsets.UTF_8) }
        } catch (_: Exception) {
            null
        }

    companion object {
        private const val FROM_TYPE = 137 // PduHeaders.FROM
    }
}
