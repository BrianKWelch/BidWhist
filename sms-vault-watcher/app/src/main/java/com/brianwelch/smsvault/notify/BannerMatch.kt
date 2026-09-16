package com.brianwelch.smsvault.notify

import android.app.Notification
import android.app.Person
import android.content.Context
import android.os.Build
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.sms.RecentSenders
import com.brianwelch.smsvault.util.PhoneMatch

/**
 * Shared, database-free banner matching used by both the notification listener
 * (which cancels a watched banner from the tray, after it is posted) and the
 * notification assistant (which demotes a watched banner BEFORE it is posted, so
 * no heads-up peek is ever shown). Both must reach the same verdict instantly,
 * with no encrypted-DB read on the hot path, so they share this logic and an
 * in-memory cache of the watched numbers.
 */
object BannerMatch {

    // Window after a watched capture during which a conversation banner is treated
    // as that message even if its on-screen text didn't parse to a number match.
    const val CAPTURE_BRIDGE_MS = 9_000L

    // Watched numbers (last-10 digits) cached in memory for synchronous matching.
    @Volatile var watchedLast10: Set<String> = emptySet()
        private set

    private val MESSAGING_PACKAGES = setOf(
        "com.samsung.android.messaging",
        "com.google.android.apps.messaging"
    )

    fun isMessagingPackage(pkg: String): Boolean =
        pkg in MESSAGING_PACKAGES ||
            pkg.contains("messaging") || pkg.contains("messages") ||
            pkg.contains(".mms") || pkg.endsWith(".sms") || pkg.contains(".sms.")

    /** Refresh the in-memory watched-number cache from the (encrypted) store. Call
     *  off the hot path — on service connect and on a timer. */
    suspend fun refresh(context: Context) {
        runCatching {
            VaultRepository.get(context).allVaultNumbers()
                .map { PhoneMatch.last10(it.e164) }.filter { it.isNotEmpty() }.toSet()
        }.getOrNull()?.let { watchedLast10 = it }
    }

    /** Synchronous, no-DB verdict: is this banner from a watched sender? */
    fun isWatchedBanner(sbn: StatusBarNotification, candidates: List<String>): Boolean {
        val isSummary = (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0
        if (candidates.isNotEmpty()) {
            if (candidates.any { c ->
                    val d = PhoneMatch.last10(c)
                    d.isNotEmpty() && (watchedLast10.contains(d) || RecentSenders.contains(d))
                }) return true
            if (candidates.any { RecentSenders.matchesBody(it) }) return true
            if (!isSummary && RecentSenders.capturedWithin(CAPTURE_BRIDGE_MS)) return true
            return false
        }
        // Blank group summary right after a watched capture.
        return isSummary && RecentSenders.capturedWithin(CAPTURE_BRIDGE_MS)
    }

    /** Every string on the notification that could identify the sender. */
    fun gatherSenderStrings(sbn: StatusBarNotification): List<String> {
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val people: ArrayList<Person>? = extras.getParcelableArrayList(Notification.EXTRA_PEOPLE_LIST)
            people?.forEach { p ->
                addCs(p.name)
                p.uri?.let { out.add(it) }
            }
        }

        runCatching {
            NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(n)?.messages?.forEach { m ->
                val person = m.person
                addCs(person?.name)
                person?.uri?.let { out.add(it) }
            }
        }
        return out
    }
}
