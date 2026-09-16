package com.brianwelch.smsvault.notify

import android.app.Notification
import android.app.Person
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import com.brianwelch.smsvault.data.VaultNumber
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.sms.RecentSenders
import com.brianwelch.smsvault.util.PhoneMatch
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Section 5: dismiss the incoming-message notification posted by the system
 * messaging app when it comes from a watched sender.
 *
 * Modern SMS apps post a MessagingStyle "conversation" notification: the title is
 * usually the contact's display name, the message body is in EXTRA_TEXT or the
 * MessagingStyle messages, and the sender's number lives in a Person uri, not the
 * title. So we gather every field that can carry the sender (title, text, subtext,
 * big text, conversation title, tag, shortcut id, EXTRA_PEOPLE_LIST people, and
 * MessagingStyle senders) and match each against the watched numbers by last-10
 * digits, and against those numbers' contact names / labels by name.
 *
 * Alongside each conversation, the app also posts a "group summary" notification
 * that carries no sender fields at all (blank title). We can't match a summary by
 * sender, so we clear it as orphaned noise whenever the ONLY conversations still
 * on screen from that app are watched ones we are removing (i.e. there is no
 * non-watched, real conversation the summary could belong to). Because the summary
 * often arrives after we cancel the child, we also re-sweep a few times on a delay.
 *
 * Watched numbers are loaded fresh on every notification (not cached once), so a
 * number added after the listener connected is still matched.
 */
class VaultNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    // Delays (ms) at which we re-scan for orphaned blank summaries after
    // suppressing a watched conversation. The summary is frequently posted a
    // beat after its child, so a single immediate pass misses it.
    private val sweepDelaysMs = longArrayOf(200L, 700L, 1500L, 3000L, 5000L)

    // When we suppress a watched message from an app, remember that briefly. A
    // blank group-summary banner that lands during this window belongs to that
    // suppressed message, so we clear it even without being able to read a sender.
    private val suppressedAt = java.util.concurrent.ConcurrentHashMap<String, Long>()
    private val suppressWindowMs = 20_000L
    private fun recentlySuppressed(pkg: String) =
        System.currentTimeMillis() - (suppressedAt[pkg] ?: 0L) < suppressWindowMs

    // A sender-bearing banner we couldn't match yet is re-checked at these delays,
    // to let the SMS/MMS capture that records the sender catch up (it can land just
    // after the banner is posted). Total added latency is ~4s worst case.
    private val RETRY_DELAYS_MS = longArrayOf(300L, 600L, 1000L, 2000L)

    // Window after a watched capture during which a single conversation banner is
    // treated as that message, even if its on-screen number text didn't parse to a
    // match. The capture itself already proved the sender is watched.
    private val CAPTURE_BRIDGE_MS = 9_000L

    override fun onListenerConnected() {
        super.onListenerConnected()
        SuppressionLog.setConnected(true)
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        SuppressionLog.setConnected(false)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in MESSAGING_PACKAGES) return
        scope.launch { evaluateAndAct(sbn, attempt = 0) }
    }

    /**
     * Decide whether to cancel [sbn], act, and log. If we can't yet tell that it is
     * a watched message (the SMS/MMS capture that records the sender can land a beat
     * AFTER the banner is posted), retry a few times on a short delay so the banner
     * is still dismissed once the capture catches up.
     */
    private suspend fun evaluateAndAct(sbn: StatusBarNotification, attempt: Int) {
        val key = sbn.key
        val pkg = sbn.packageName
        val title = sbn.notification.extras
            .getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val isSummary = (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0
        val candidates = gatherSenderStrings(sbn)

        var cancel = false
        var reason: String

        if (candidates.isNotEmpty()) {
            when {
                shouldSuppressBySender(candidates) -> { cancel = true; reason = "sender matched a watched number" }
                // Capture-time bridge: a watched message was captured moments ago and
                // this is a single conversation banner. The capture already proved the
                // sender is watched, so dismiss it even if the banner's number text
                // didn't parse to a match. Summaries are handled separately.
                !isSummary && RecentSenders.capturedWithin(CAPTURE_BRIDGE_MS) -> { cancel = true; reason = "recent watched capture (time bridge)" }
                else -> reason = "sender not watched"
            }
        } else if (isSummary && recentlySuppressed(pkg)) {
            cancel = true; reason = "blank group summary during suppression window"
        } else if (!hasNonWatchedConversation(pkg)) {
            cancel = true; reason = "sender-less placeholder, no other conversation active"
        } else {
            reason = "sender-less but a non-watched conversation is active"
        }

        val flags = buildString {
            append(if (isSummary) "summary" else "single")
            append(", fields=").append(candidates.size)
            if (attempt > 0) append(", try=").append(attempt + 1)
            if (!cancel && candidates.isNotEmpty()) {
                val preview = candidates.joinToString(" | ") { it.take(24) }.take(80)
                append(" [").append(preview).append("]")
            }
        }

        if (cancel) {
            runCatching { cancelNotification(key) }
            if (candidates.isNotEmpty()) suppressedAt[pkg] = System.currentTimeMillis()
            SuppressionLog.record(pkg, if (title.isBlank()) "(no title)" else title, true, "$flags | $reason")
            scheduleNoiseSweeps(pkg)
            return
        }

        // Not cancelled. If this is a sender-bearing conversation we simply couldn't
        // match yet, re-check shortly in case the capture is still in flight. Only
        // log the final verdict, so the diagnostic isn't spammed with retries.
        if (candidates.isNotEmpty() && attempt < RETRY_DELAYS_MS.size) {
            delay(RETRY_DELAYS_MS[attempt])
            evaluateAndAct(sbn, attempt + 1)
        } else {
            SuppressionLog.record(pkg, if (title.isBlank()) "(no title)" else title, false, "$flags | $reason")
        }
    }

    /** Fire several delayed passes that clear any orphaned blank summary left
     *  behind once the watched conversation itself is gone. */
    private fun scheduleNoiseSweeps(pkg: String) {
        scope.launch {
            for (d in sweepDelaysMs) {
                delay(d)
                clearOrphanNoise(pkg)
            }
        }
    }

    /** Re-sweep after a suppression. Blank group summaries are cleared outright
     *  (removing a summary never hides a child conversation). Blank non-summary
     *  placeholders are cleared only when no real non-watched conversation is
     *  active, so we never hide a genuine notification from another thread. */
    private suspend fun clearOrphanNoise(pkg: String) {
        val active = runCatching { activeNotifications }.getOrNull() ?: return
        val nonWatched = hasNonWatchedConversation(pkg)
        active.filter { it.packageName == pkg && gatherSenderStrings(it).isEmpty() }
            .forEach {
                val isSummary = (it.notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0
                if (isSummary || !nonWatched) {
                    runCatching { cancelNotification(it.key) }
                    SuppressionLog.record(pkg, "(cleared noise)", true, if (isSummary) "summary sweep" else "placeholder sweep")
                }
            }
    }

    /** True if [pkg] has an active conversation notification (has sender fields)
     *  that is NOT from a watched number — a real thread whose summary we must
     *  leave alone. Watched conversations don't count: we are removing those. */
    private suspend fun hasNonWatchedConversation(pkg: String): Boolean {
        val active = runCatching { activeNotifications }.getOrNull() ?: return false
        for (sb in active) {
            if (sb.packageName != pkg) continue
            if ((sb.notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) continue
            val cands = gatherSenderStrings(sb)
            if (cands.isEmpty()) continue // sender-less child is itself noise
            if (!shouldSuppressBySender(cands)) return true
        }
        return false
    }

    private suspend fun shouldSuppressBySender(candidates: List<String>): Boolean {
        val numbers: List<VaultNumber> = runCatching {
            VaultRepository.get(applicationContext).allVaultNumbers()
        }.getOrDefault(emptyList())
        if (numbers.isEmpty() && RecentSenders.snapshot().isEmpty()) return false

        val e164s = numbers.map { it.e164 }

        // 1) Any field carrying a watched number (raw-number titles, tel: uris).
        if (candidates.any { PhoneMatch.matchesAny(it, e164s) }) return true

        // 2) Any field carrying a watched number's contact name or user label.
        val names = buildSet {
            addAll(ContactNames.forNumbers(applicationContext, e164s))
            addAll(numbers.mapNotNull { it.label?.takeIf { l -> l.isNotBlank() } })
        }
        if (names.isNotEmpty() && candidates.any { field ->
                val f = field.trim()
                f.isNotBlank() && names.any { n -> f.equals(n.trim(), ignoreCase = true) || f.contains(n.trim(), ignoreCase = true) }
            }
        ) return true

        // 3) Recent-capture bridge: a watched message was just vaulted. Match its
        // sender's number against this notification.
        val recent = RecentSenders.snapshot()
        if (recent.isNotEmpty()) {
            if (candidates.any { PhoneMatch.last10(it).let { d -> d.isNotEmpty() && recent.contains(d) } }) return true
        }

        // 4) Content bridge: the notification's text is the exact body of a message
        // we just captured from a watched sender. This catches the common case
        // where the sender is a saved contact, so the notification shows a name
        // (no number anywhere) but the message text still matches.
        if (candidates.any { RecentSenders.matchesBody(it) }) return true
        return false
    }

    /** Every string on the notification that could identify the sender. */
    private fun gatherSenderStrings(sbn: StatusBarNotification): List<String> {
        val n = sbn.notification
        val extras = n.extras
        val out = ArrayList<String>()
        fun addCs(v: CharSequence?) { v?.toString()?.takeIf { it.isNotBlank() }?.let { out.add(it) } }

        addCs(extras.getCharSequence(Notification.EXTRA_TITLE))
        addCs(extras.getCharSequence(Notification.EXTRA_TITLE_BIG))
        addCs(extras.getCharSequence(Notification.EXTRA_TEXT))
        addCs(extras.getCharSequence(Notification.EXTRA_SUB_TEXT))
        addCs(extras.getCharSequence(Notification.EXTRA_BIG_TEXT))
        addCs(extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT))
        addCs(extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE))
        sbn.tag?.let { out.add(it) }
        n.shortcutId?.let { out.add(it) }

        // EXTRA_PEOPLE_LIST (Person objects) — name and uri (uri is often tel:<num>).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val people: ArrayList<Person>? = extras.getParcelableArrayList(Notification.EXTRA_PEOPLE_LIST)
            people?.forEach { p ->
                addCs(p.name)
                p.uri?.let { out.add(it) }
            }
        }

        // MessagingStyle senders and their person uris.
        runCatching {
            NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(n)?.messages?.forEach { m ->
                val person = m.person
                addCs(person?.name)
                person?.uri?.let { out.add(it) }
            }
        }
        return out
    }

    companion object {
        private val MESSAGING_PACKAGES = setOf(
            "com.samsung.android.messaging",
            "com.google.android.apps.messaging"
        )
    }
}
