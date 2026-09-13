package com.brianwelch.smsvault.role

import android.content.Context
import android.net.Uri
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.util.PhoneMatch

/**
 * Scans content://mms for the historical import (spec 7). Mirrors the observer's
 * sender resolution (addr type 137) and part reading (text/plain + image/video),
 * streaming media into the vault rather than buffering.
 */
class HistoricalMmsImporter(
    private val context: Context,
    private val repo: VaultRepository,
    private val numbers: List<String>
) {
    private val FROM_TYPE = 137

    suspend fun run(): Int {
        var imported = 0
        context.contentResolver.query(
            Uri.parse("content://mms"),
            arrayOf("_id", "date", "sub_id"),
            null, null, "_id ASC"
        )?.use { c ->
            val idCol = c.getColumnIndexOrThrow("_id")
            val dateCol = c.getColumnIndex("date")
            val subCol = c.getColumnIndex("sub_id")
            while (c.moveToNext()) {
                val mmsId = c.getLong(idCol)
                val sender = senderOf(mmsId) ?: continue
                if (!PhoneMatch.matchesAny(sender, numbers)) continue
                val (text, media) = readParts(mmsId)
                val stored = repo.storeMessage(
                    senderRaw = sender,
                    body = text,
                    receivedAt = if (dateCol >= 0) c.getLong(dateCol) * 1000L else System.currentTimeMillis(),
                    subscriptionId = if (subCol >= 0) c.getInt(subCol) else -1,
                    source = "mms",
                    providerRowId = mmsId,
                    attachments = media
                )
                if (stored != null) imported++ else media.forEach { runCatching { it.stream.close() } }
            }
        }
        return imported
    }

    private fun senderOf(mmsId: Long): String? =
        context.contentResolver.query(
            Uri.parse("content://mms/$mmsId/addr"),
            arrayOf("address", "type"),
            "type = ?", arrayOf(FROM_TYPE.toString()), null
        )?.use { c -> if (c.moveToFirst()) c.getString(0) else null }

    private fun readParts(mmsId: Long): Pair<String?, List<VaultRepository.PendingAttachment>> {
        val text = StringBuilder()
        val media = ArrayList<VaultRepository.PendingAttachment>()
        context.contentResolver.query(
            Uri.parse("content://mms/part"),
            arrayOf("_id", "ct", "text"),
            "mid = ?", arrayOf(mmsId.toString()), null
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
                        if (!inline.isNullOrEmpty()) text.append(inline)
                    }
                    ct.startsWith("image/") || ct.startsWith("video/") -> {
                        context.contentResolver.openInputStream(Uri.parse("content://mms/part/$partId"))
                            ?.let { media += VaultRepository.PendingAttachment(ct, it) }
                    }
                }
            }
        }
        return (if (text.isEmpty()) null else text.toString()) to media
    }
}
