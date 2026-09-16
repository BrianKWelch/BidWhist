package com.brianwelch.smsvault.sms

/**
 * Section 5 race-condition bridge.
 *
 * The system messaging notification can post before the SMS receiver has written
 * the vault row. The receiver drops the matched sender here the instant it
 * recognizes it; the NotificationListenerService consults this set so it can
 * cancel a notification even when the DB write has not landed yet.
 *
 * Entries expire after 60 seconds.
 */
object RecentSenders {

    private const val TTL_MS = 60_000L
    private val seen = HashMap<String, Long>()
    // Bodies of watched messages we just captured. A messaging notification whose
    // text is one of these is the same message, even when it shows the sender as a
    // saved contact name (so no phone number appears anywhere to match on).
    private val bodies = HashMap<String, Long>()
    // A bare timestamp of the most recent watched capture, for image/empty-body
    // messages where there is no text to correlate on.
    @Volatile private var lastCaptureAt: Long = 0L

    @Synchronized
    fun mark(last10: String) {
        if (last10.isBlank()) return
        prune()
        seen[last10] = System.currentTimeMillis()
        lastCaptureAt = System.currentTimeMillis()
    }

    @Synchronized
    fun markBody(body: String?) {
        val b = normalize(body) ?: return
        prune()
        bodies[b] = System.currentTimeMillis()
    }

    @Synchronized
    fun contains(last10: String): Boolean {
        if (last10.isBlank()) return false
        prune()
        return seen.containsKey(last10)
    }

    /** True if [field] contains (or equals) a body we recently captured. */
    @Synchronized
    fun matchesBody(field: String?): Boolean {
        val f = normalize(field) ?: return false
        prune()
        return bodies.keys.any { b -> f == b || f.contains(b) || b.contains(f) }
    }

    /** A watched message was captured within [windowMs]. Used only as a last
     *  resort for image/empty-body messages that carry no text to match. */
    fun capturedWithin(windowMs: Long): Boolean =
        lastCaptureAt != 0L && System.currentTimeMillis() - lastCaptureAt < windowMs

    @Synchronized
    fun snapshot(): Set<String> {
        prune()
        return seen.keys.toSet()
    }

    private fun normalize(s: String?): String? =
        s?.trim()?.lowercase()?.takeIf { it.length >= 2 }

    private fun prune() {
        val now = System.currentTimeMillis()
        seen.entries.removeAll { now - it.value > TTL_MS }
        bodies.entries.removeAll { now - it.value > TTL_MS }
    }
}
