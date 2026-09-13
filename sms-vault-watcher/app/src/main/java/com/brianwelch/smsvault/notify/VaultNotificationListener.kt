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
 * Watched numbers are loaded fresh on every notification (not cached once), so a
 * number added after the listener connected is still matched.
 */
class VaultNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in MESSAGING_PACKAGES) return
        val key = sbn.key
        // Do the work off the main thread; loads DB + contacts and cancels on match.
        scope.launch {
            if (shouldSuppress(sbn)) {
                runCatching { cancelNotification(key) }
            }
        }
    }

    private suspend fun shouldSuppress(sbn: StatusBarNotification): Boolean {
        val numbers: List<VaultNumber> = runCatching {
            VaultRepository.get(applicationContext).allVaultNumbers()
        }.getOrDefault(emptyList())
        if (numbers.isEmpty() && RecentSenders.snapshot().isEmpty()) return false

        val e164s = numbers.map { it.e164 }
        val candidates = gatherSenderStrings(sbn)

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
        // sender's number (digits) or contact name against this notification.
        val recent = RecentSenders.snapshot()
        if (recent.isNotEmpty()) {
            if (candidates.any { PhoneMatch.last10(it).let { d -> d.isNotEmpty() && recent.contains(d) } }) return true
        }
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
