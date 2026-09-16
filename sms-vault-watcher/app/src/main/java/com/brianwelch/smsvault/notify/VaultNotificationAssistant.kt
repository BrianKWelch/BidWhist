package com.brianwelch.smsvault.notify

import android.app.NotificationManager
import android.os.Bundle
import android.service.notification.Adjustment
import android.service.notification.NotificationAssistantService
import android.service.notification.StatusBarNotification
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The ONLY hook a non-default app has BEFORE a notification is shown.
 *
 * onNotificationEnqueued runs while the notification is still being posted, before
 * the system decides whether to pop a heads-up banner. By returning an Adjustment
 * that demotes a watched message to minimum importance, we stop the peek and the
 * sound from ever appearing. The notification listener still removes it from the
 * tray afterwards; together that means a watched sender produces nothing on screen.
 *
 * This requires the user to enable this app as the device "notification assistant"
 * (a single, one-time special-access grant). Without it, the listener alone still
 * clears the tray, but Android shows the ~4s peek first because it renders before
 * any non-default app is even notified.
 */
class VaultNotificationAssistant : NotificationAssistantService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onListenerConnected() {
        super.onListenerConnected()
        AssistantState.connected = true
        scope.launch {
            BannerMatch.refresh(applicationContext)
            while (true) { delay(30_000L); BannerMatch.refresh(applicationContext) }
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        AssistantState.connected = false
    }

    override fun onNotificationEnqueued(sbn: StatusBarNotification): Adjustment? {
        if (!BannerMatch.isMessagingPackage(sbn.packageName)) return null
        val candidates = BannerMatch.gatherSenderStrings(sbn)
        if (!BannerMatch.isWatchedBanner(sbn, candidates)) return null
        return demote(sbn)
    }

    /** Also cancel from the tray, so nothing lingers after the demote. */
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!BannerMatch.isMessagingPackage(sbn.packageName)) return
        val candidates = BannerMatch.gatherSenderStrings(sbn)
        if (BannerMatch.isWatchedBanner(sbn, candidates)) {
            runCatching { cancelNotification(sbn.key) }
            SuppressionLog.record(sbn.packageName, "(assistant)", true, "demoted + cancelled")
        }
    }

    private fun demote(sbn: StatusBarNotification): Adjustment {
        val signals = Bundle().apply {
            putInt(Adjustment.KEY_IMPORTANCE, NotificationManager.IMPORTANCE_MIN)
        }
        // Adjustment(packageName, key, signals, explanation, userHandle) — the
        // 5-arg form is available since API 29; targetSdk here is well above that.
        return Adjustment(sbn.packageName, sbn.key, signals, "watched by SMS Vault", sbn.user)
    }
}

/** Tiny holder so the UI can show whether the assistant is actually connected. */
object AssistantState {
    @Volatile var connected: Boolean = false
}
