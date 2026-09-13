package com.brianwelch.smsvault.util

import android.telephony.PhoneNumberUtils
import java.util.Locale

/**
 * Section 4.3 number matching.
 *
 *  - Normalize to E.164 where possible via PhoneNumberUtils.
 *  - Primary comparison is on the last 10 digits, which survives country-code
 *    and formatting variance.
 *  - Fallback is a case- and whitespace-insensitive compare of the raw strings.
 */
object PhoneMatch {

    fun normalizeToE164(raw: String?, region: String = Locale.getDefault().country): String {
        if (raw.isNullOrBlank()) return ""
        val formatted = PhoneNumberUtils.formatNumberToE164(raw.trim(), region.ifBlank { "US" })
        return formatted ?: digitsOnly(raw)
    }

    fun digitsOnly(raw: String?): String =
        raw?.filter { it.isDigit() }.orEmpty()

    fun last10(raw: String?): String {
        val digits = digitsOnly(raw)
        return if (digits.length <= 10) digits else digits.takeLast(10)
    }

    /** True if [candidate] matches any entry in [storedNumbers]. */
    fun matchesAny(candidate: String?, storedNumbers: Collection<String>): Boolean {
        if (candidate.isNullOrBlank()) return false
        val cLast10 = last10(candidate)
        val cRaw = candidate.trim().lowercase().replace("\\s".toRegex(), "")
        for (stored in storedNumbers) {
            if (cLast10.isNotEmpty() && cLast10 == last10(stored)) return true
            val sRaw = stored.trim().lowercase().replace("\\s".toRegex(), "")
            if (cRaw.isNotEmpty() && cRaw == sRaw) return true
        }
        return false
    }

    /** Returns the stored E.164 that matches, or null. Used to canonicalize senders. */
    fun canonicalFor(candidate: String?, storedNumbers: Collection<String>): String? {
        if (candidate.isNullOrBlank()) return null
        val cLast10 = last10(candidate)
        return storedNumbers.firstOrNull { cLast10.isNotEmpty() && cLast10 == last10(it) }
    }
}
