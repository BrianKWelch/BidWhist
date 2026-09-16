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
        // Register on several roots; OEMs vary in which URI they notify when an
        // incoming MMS is written.
        for (u in listOf("content://mms-sms/", "content://mms", "content://sms")) {
            runCatching {
                context.contentResolver.registerContentObserver(Uri.parse(u), true, this)
            }
        }
        // Run one sweep at startup to catch anything that arrived while dead.
        onChange(false)
    }

    /** Force an immediate sweep (app open, periodic backstop, manual rescan). */
    fun triggerSweep() = onChange(false)

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
        // The bookmark may advance ONLY past rows we have fully handled. An incoming
        // MMS appears in content://mms as an empty shell first; its sender address
        // and media parts are filled in a beat later as the default app downloads
        // it. If we advanced the bookmark past that shell (the old behavior), the
        // "_id > bookmark" filter would never revisit the row and the picture was
        // lost forever. So we stop at the first row that is not ready yet and retry
        // it on the next sweep, unless it is old enough that it never will be.
        var newBookmark = lastId
        val now = System.currentTimeMillis()

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
                val receivedAt = if (dateCol >= 0) c.getLong(dateCol) * 1000L else now
                val stale = now - receivedAt > STALE_MS

                val sender = senderOf(mmsId)
                if (sender == null) {
                    // Shell row: address not written yet. Retry next sweep; only give
                    // up (and advance) once it is stale, so we never permanently skip
                    // a live message but also never stall on a dead one.
                    if (stale) { newBookmark = mmsId; continue } else break
                }

                if (!PhoneMatch.matchesAny(sender, stored)) {
                    // Fully resolved and not watched: safe to advance past it.
                    newBookmark = mmsId
                    continue
                }

                // Watched. Only capture once the parts have actually landed; storing
                // an empty shell would let the provider-row de-dupe block the real
                // capture that arrives moments later.
                val (text, media) = readParts(mmsId)
                if (text.isNullOrEmpty() && media.isEmpty() && !stale) {
                    media.forEach { it.stream.closeQuietly() }
                    break // media still downloading; retry next sweep
                }

                RecentSenders.mark(PhoneMatch.last10(sender))
                RecentSenders.markBody(text)

                val subId = if (subCol >= 0) c.getInt(subCol) else -1
                val newId = repo.storeMessage(
                    senderRaw = sender,
                    body = text,
                    receivedAt = receivedAt,
                    subscriptionId = subId,
                    source = "mms",
                    providerRowId = mmsId,
                    attachments = media
                )
                if (newId != null) {
                    VaultAlerts.notify(context, repo.labelFor(sender))
                }
                newBookmark = mmsId
            }
        }

        if (newBookmark > lastId) repo.setLastProcessedMmsId(newBookmark)
    }

    private fun java.io.InputStream.closeQuietly() = try { close() } catch (_: Exception) {}

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
        // How long to keep retrying a not-yet-downloaded MMS before giving up and
        // advancing past it, so a message that never finishes cannot stall capture
        // of newer ones. Generous: auto-download normally completes in seconds.
        private const val STALE_MS = 120_000L
    }
}
