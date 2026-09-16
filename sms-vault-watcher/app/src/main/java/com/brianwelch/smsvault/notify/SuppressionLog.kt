package com.brianwelch.smsvault.notify

/**
 * A tiny in-memory record of what the notification listener saw and did, so the
 * user can tell us whether it is connected and whether it is matching/cancelling
 * messaging notifications. Debug aid only; nothing is persisted.
 */
object SuppressionLog {

    data class Entry(
        val ts: Long,
        val pkg: String,
        val title: String,
        val cancelled: Boolean,
        val detail: String = ""
    )

    @Volatile var listenerConnected: Boolean = false
        private set

    private val entries = ArrayDeque<Entry>()
    private const val MAX = 40

    fun setConnected(connected: Boolean) { listenerConnected = connected }

    @Synchronized
    fun record(pkg: String, title: String, cancelled: Boolean, detail: String = "") {
        entries.addFirst(Entry(System.currentTimeMillis(), pkg, title, cancelled, detail))
        while (entries.size > MAX) entries.removeLast()
    }

    @Synchronized
    fun snapshot(): List<Entry> = entries.toList()

    @Synchronized
    fun clear() = entries.clear()
}
