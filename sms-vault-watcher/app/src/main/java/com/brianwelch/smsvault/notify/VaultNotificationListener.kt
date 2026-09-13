package com.brianwelch.smsvault.notify

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
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
 * Matching strategy, in order of confidence:
 *   1. The in-memory RecentSenders set (populated by the SMS receiver / MMS
 *      observer). This wins the race where the notification posts before the DB
 *      write lands.
 *   2. The persisted vault numbers and their contact display names, checked
 *      against EXTRA_TITLE / EXTRA_TEXT / tag / shortcutId.
 *
 * This app never posts its own notification for a vaulted message, so there is no
 * risk of cancelling our own.
 */
class VaultNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    @Volatile private var storedNumbers: List<String> = emptyList()

    override fun onListenerConnected() {
        super.onListenerConnected()
        refreshNumbers()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in MESSAGING_PACKAGES) return

        // Fast path: recently captured sender.
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val tag = sbn.tag.orEmpty()
        val shortcut = sbn.notification.shortcutId.orEmpty()

        if (matchesRecent(title, text, tag, shortcut)) {
            cancelNotification(sbn.key)
            return
        }

        // Slow path: compare against persisted numbers / display names.
        scope.launch {
            if (matchesStored(title, text, tag, shortcut)) {
                cancelNotification(sbn.key)
            }
        }
    }

    private fun matchesRecent(vararg fields: String): Boolean {
        val recent = RecentSenders.snapshot()
        if (recent.isEmpty()) return false
        return fields.any { field ->
            val last10 = PhoneMatch.last10(field)
            last10.isNotEmpty() && recent.contains(last10)
        }
    }

    private fun matchesStored(title: String, text: String, tag: String, shortcut: String): Boolean {
        val numbers = storedNumbers
        if (numbers.isEmpty()) return false
        // Any field that carries a phone number matching the vault list.
        val fields = listOf(title, text, tag, shortcut)
        if (fields.any { PhoneMatch.matchesAny(it, numbers) }) return true
        // Contact display-name fallback: a watched number saved as a contact will
        // surface as its display name in EXTRA_TITLE. Compare titles against the
        // contact names resolved for the vault numbers.
        val names = ContactNames.forNumbers(this, numbers)
        return names.any { name ->
            name.isNotBlank() && title.trim().equals(name.trim(), ignoreCase = true)
        }
    }

    private fun refreshNumbers() {
        scope.launch {
            storedNumbers = VaultRepository.get(applicationContext).storedNumbers()
        }
    }

    companion object {
        private val MESSAGING_PACKAGES = setOf(
            "com.samsung.android.messaging",
            "com.google.android.apps.messaging"
        )
    }
}
