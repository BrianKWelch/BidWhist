package com.brianwelch.smsvault.data

import android.content.Context
import com.brianwelch.smsvault.crypto.MediaCrypto
import com.brianwelch.smsvault.util.PhoneMatch
import kotlinx.coroutines.flow.Flow
import java.io.InputStream

/**
 * The single write path into the vault. Capture sources (SMS receiver, MMS
 * observer, historical import) all funnel through here so matching, thread-key
 * derivation and de-duplication live in one place.
 */
class VaultRepository private constructor(
    private val context: Context,
    private val dao: VaultDao
) {

    fun observeNumbers(): Flow<List<VaultNumber>> = dao.observeNumbers()
    fun observeThreads(): Flow<List<ThreadSummary>> = dao.observeThreads()
    fun observeThreadMessages(key: String): Flow<List<VaultMessage>> = dao.observeThreadMessages(key)
    fun observePendingDeleteCount(): Flow<Int> = dao.observePendingDeleteCount()

    suspend fun storedNumbers(): List<String> = dao.allNumbers().map { it.e164 }

    suspend fun addNumber(e164: String, label: String?) {
        val normalized = PhoneMatch.normalizeToE164(e164)
        if (normalized.isBlank()) return
        dao.insertNumber(VaultNumber(e164 = normalized, label = label, added_at = System.currentTimeMillis()))
    }

    suspend fun renameNumber(id: Long, label: String?) = dao.renameNumber(id, label)
    suspend fun deleteNumber(id: Long) = dao.deleteNumber(id)

    suspend fun isWatched(sender: String?): Boolean =
        PhoneMatch.matchesAny(sender, storedNumbers())

    /**
     * The label the user assigned to the number that [sender] matches, or null.
     * Used to title the private arrival alert (the label is the on-screen text).
     */
    suspend fun labelFor(sender: String?): String? {
        if (sender.isNullOrBlank()) return null
        val last10 = PhoneMatch.last10(sender)
        if (last10.isBlank()) return null
        return dao.allNumbers().firstOrNull { PhoneMatch.last10(it.e164) == last10 }?.label
    }

    private fun threadKeyFor(senderE164: String): String = PhoneMatch.last10(senderE164)

    /**
     * Store one captured message and its (already-decrypted) media parts. Media
     * is streamed to disk here so callers never hold a full attachment in memory.
     * Returns the new message id, or null if it was a duplicate.
     */
    suspend fun storeMessage(
        senderRaw: String,
        body: String?,
        receivedAt: Long,
        subscriptionId: Int,
        source: String,
        providerRowId: Long?,
        attachments: List<PendingAttachment>
    ): Long? {
        // De-dupe on provider row so a restart mid-sweep cannot double-insert.
        if (providerRowId != null && dao.countByProviderRow(source, providerRowId) > 0) {
            attachments.forEach { it.stream.closeQuietly() }
            return null
        }
        val stored = storedNumbers()
        val canonical = PhoneMatch.canonicalFor(senderRaw, stored)
            ?: PhoneMatch.normalizeToE164(senderRaw)
        val threadKey = threadKeyFor(canonical)

        val messageId = dao.insertMessage(
            VaultMessage(
                sender_e164 = canonical,
                body = body,
                received_at = receivedAt,
                subscription_id = subscriptionId,
                source = source,
                provider_row_id = providerRowId,
                provider_deleted = 0,
                thread_key = threadKey
            )
        )

        if (attachments.isNotEmpty()) {
            val rows = attachments.map { pending ->
                val saved = pending.stream.use { MediaCrypto.writeStream(context, it) }
                VaultAttachment(
                    message_id = messageId,
                    mime_type = pending.mimeType,
                    encrypted_filename = saved.encryptedName,
                    byte_size = saved.byteSize
                )
            }
            dao.insertAttachments(rows)
        }
        return messageId
    }

    suspend fun messagesWithAttachments(messages: List<VaultMessage>) =
        dao.threadWithAttachments(messages)

    // ---- MMS bookmark ------------------------------------------------------

    suspend fun lastProcessedMmsId(): Long = dao.bookmark(BOOKMARK_MMS) ?: 0L
    suspend fun setLastProcessedMmsId(id: Long) = dao.setBookmark(VaultBookmark(BOOKMARK_MMS, id))

    // ---- purge sweep -------------------------------------------------------

    suspend fun pendingProviderDeletes(): List<VaultMessage> = dao.pendingProviderDeletes()
    suspend fun markProviderDeleted(id: Long) = dao.markProviderDeleted(id)

    data class PendingAttachment(val mimeType: String, val stream: InputStream)

    companion object {
        private const val BOOKMARK_MMS = "last_processed_mms_id"

        @Volatile private var instance: VaultRepository? = null

        fun get(context: Context): VaultRepository =
            instance ?: synchronized(this) {
                instance ?: VaultRepository(
                    context.applicationContext,
                    VaultDatabase.get(context).dao()
                ).also { instance = it }
            }

        private fun InputStream.closeQuietly() = try { close() } catch (_: Exception) {}
    }
}
