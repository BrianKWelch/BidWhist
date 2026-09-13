package com.brianwelch.smsvault.notify

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import com.brianwelch.smsvault.util.PhoneMatch

/**
 * Resolves the contact display name(s) for a set of vault numbers, so the
 * notification listener can match a Samsung/Google Messages notification whose
 * title is the contact name rather than the raw number.
 *
 * Cached briefly; contacts rarely change within a session.
 */
object ContactNames {

    private var cacheKey: Set<String> = emptySet()
    private var cacheValue: List<String> = emptyList()
    private var cacheAt: Long = 0
    private const val TTL_MS = 5 * 60_000L

    @Synchronized
    fun forNumbers(context: Context, numbers: List<String>): List<String> {
        val key = numbers.toSet()
        val now = System.currentTimeMillis()
        if (key == cacheKey && now - cacheAt < TTL_MS) return cacheValue

        val names = ArrayList<String>()
        for (number in numbers) {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(number)
            )
            try {
                context.contentResolver.query(
                    uri,
                    arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                    null, null, null
                )?.use { c ->
                    if (c.moveToFirst()) c.getString(0)?.let { names.add(it) }
                }
            } catch (_: SecurityException) {
                // READ_CONTACTS not granted; name matching is a best-effort extra.
            }
        }
        cacheKey = key
        cacheValue = names
        cacheAt = now
        return names
    }

    /** Convenience for a single number, used by the UI's number labels. */
    fun forNumber(context: Context, number: String): String? =
        forNumbers(context, listOf(number)).firstOrNull()

    fun matches(displayName: String, storedNumbers: List<String>, context: Context): Boolean {
        val names = forNumbers(context, storedNumbers)
        return names.any { it.equals(displayName.trim(), ignoreCase = true) } ||
            PhoneMatch.matchesAny(displayName, storedNumbers)
    }
}
