package com.brianwelch.smsvault.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Section 6 schema. Column names mirror the spec exactly.
 */

@Entity(
    tableName = "vault_message",
    indices = [Index("sender_e164"), Index("provider_row_id"), Index("thread_key")]
)
data class VaultMessage(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sender_e164: String,
    val body: String?,
    val received_at: Long,
    val subscription_id: Int,
    val source: String,              // 'sms' | 'mms'
    val provider_row_id: Long?,      // _id in content://sms or content://mms
    val provider_deleted: Int = 0,   // 0 | 1
    val thread_key: String
)

@Entity(
    tableName = "vault_attachment",
    foreignKeys = [
        ForeignKey(
            entity = VaultMessage::class,
            parentColumns = ["id"],
            childColumns = ["message_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("message_id")]
)
data class VaultAttachment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val message_id: Long,
    val mime_type: String,
    val encrypted_filename: String,
    val byte_size: Long
)

@Entity(
    tableName = "vault_number",
    indices = [Index(value = ["e164"], unique = true)]
)
data class VaultNumber(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val e164: String,
    val label: String?,
    val added_at: Long
)

/** Read model: a message plus its attachments, assembled by the DAO. */
data class MessageWithAttachments(
    val message: VaultMessage,
    val attachments: List<VaultAttachment>
)

/** Read model for the thread list: one row per sender with a summary. */
data class ThreadSummary(
    val thread_key: String,
    val sender_e164: String,
    val message_count: Int,
    val last_received_at: Long,
    val last_body: String?
)
