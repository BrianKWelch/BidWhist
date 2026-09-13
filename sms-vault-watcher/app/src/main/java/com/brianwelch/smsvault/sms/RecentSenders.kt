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

    @Synchronized
    fun mark(last10: String) {
        if (last10.isBlank()) return
        prune()
        seen[last10] = System.currentTimeMillis()
    }

    @Synchronized
    fun contains(last10: String): Boolean {
        if (last10.isBlank()) return false
        prune()
        return seen.containsKey(last10)
    }

    @Synchronized
    fun snapshot(): Set<String> {
        prune()
        return seen.keys.toSet()
    }

    private fun prune() {
        val now = System.currentTimeMillis()
        val it = seen.entries.iterator()
        while (it.hasNext()) {
            if (now - it.next().value > TTL_MS) it.remove()
        }
    }
}
