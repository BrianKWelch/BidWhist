package com.brianwelch.smsvault.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

@Dao
interface VaultDao {

    // ---- vault_number ------------------------------------------------------

    @Query("SELECT * FROM vault_number ORDER BY added_at DESC")
    fun observeNumbers(): Flow<List<VaultNumber>>

    @Query("SELECT * FROM vault_number")
    suspend fun allNumbers(): List<VaultNumber>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertNumber(number: VaultNumber): Long

    @Query("UPDATE vault_number SET label = :label WHERE id = :id")
    suspend fun renameNumber(id: Long, label: String?)

    @Query("DELETE FROM vault_number WHERE id = :id")
    suspend fun deleteNumber(id: Long)

    // ---- vault_message -----------------------------------------------------

    @Insert
    suspend fun insertMessage(message: VaultMessage): Long

    @Insert
    suspend fun insertAttachments(attachments: List<VaultAttachment>)

    @Query(
        "SELECT COUNT(*) FROM vault_message " +
            "WHERE source = :source AND provider_row_id = :providerRowId"
    )
    suspend fun countByProviderRow(source: String, providerRowId: Long): Int

    @Query(
        """
        SELECT thread_key,
               sender_e164        AS sender_e164,
               COUNT(*)           AS message_count,
               MAX(received_at)   AS last_received_at,
               (SELECT body FROM vault_message m2
                 WHERE m2.thread_key = m1.thread_key
                 ORDER BY received_at DESC LIMIT 1) AS last_body
        FROM vault_message m1
        GROUP BY thread_key
        ORDER BY last_received_at DESC
        """
    )
    fun observeThreads(): Flow<List<ThreadSummary>>

    @Query("SELECT * FROM vault_message WHERE thread_key = :threadKey ORDER BY received_at ASC")
    fun observeThreadMessages(threadKey: String): Flow<List<VaultMessage>>

    @Query("SELECT * FROM vault_attachment WHERE message_id IN (:messageIds)")
    suspend fun attachmentsFor(messageIds: List<Long>): List<VaultAttachment>

    // ---- gallery + delete --------------------------------------------------

    /** All media newest-first, for the in-vault gallery. */
    @Query(
        """
        SELECT a.id AS id, a.message_id AS message_id, a.mime_type AS mime_type,
               a.encrypted_filename AS encrypted_filename, a.byte_size AS byte_size,
               m.received_at AS received_at, m.sender_e164 AS sender_e164
        FROM vault_attachment a
        JOIN vault_message m ON a.message_id = m.id
        ORDER BY m.received_at DESC, a.id DESC
        """
    )
    fun observeGallery(): Flow<List<GalleryItem>>

    @Query("SELECT * FROM vault_attachment WHERE message_id = :messageId")
    suspend fun attachmentsForMessage(messageId: Long): List<VaultAttachment>

    /** Deletes a message; its attachment rows cascade. Media files are removed
     *  separately by the repository before this is called. */
    @Query("DELETE FROM vault_message WHERE id = :messageId")
    suspend fun deleteMessage(messageId: Long)

    @Transaction
    suspend fun threadWithAttachments(messages: List<VaultMessage>): List<MessageWithAttachments> {
        if (messages.isEmpty()) return emptyList()
        val byMessage = attachmentsFor(messages.map { it.id }).groupBy { it.message_id }
        return messages.map { MessageWithAttachments(it, byMessage[it.id].orEmpty()) }
    }

    // ---- purge sweep -------------------------------------------------------

    @Query("SELECT * FROM vault_message WHERE provider_deleted = 0")
    suspend fun pendingProviderDeletes(): List<VaultMessage>

    @Query("SELECT COUNT(*) FROM vault_message WHERE provider_deleted = 0")
    fun observePendingDeleteCount(): Flow<Int>

    @Query("UPDATE vault_message SET provider_deleted = 1 WHERE id = :id")
    suspend fun markProviderDeleted(id: Long)

    // ---- MMS bookmark ------------------------------------------------------
    // last_processed_mms_id is kept in a tiny single-row table so it survives a
    // process restart (spec 4.2).

    @Query("SELECT value FROM vault_bookmark WHERE key = :key")
    suspend fun bookmark(key: String): Long?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setBookmark(bookmark: VaultBookmark)
}

@androidx.room.Entity(tableName = "vault_bookmark")
data class VaultBookmark(
    @androidx.room.PrimaryKey val key: String,
    val value: Long
)
