package com.brianwelch.smsvault.notify

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.brianwelch.smsvault.MainActivity

/**
 * The user-authored arrival alert.
 *
 * When a watched number's message is captured, we post a single notification
 * whose ONLY visible text is the label the user gave that number (e.g.
 * "NEWS Alert"). No sender, number, or message content is shown, so nothing
 * sensitive appears on the lock screen. Tapping it opens the vault (which is
 * biometric-gated). If the number has no label, no alert is posted.
 *
 * This is the one notification the app posts for a vaulted message, and only
 * because the owner asked for it on their own device.
 */
object VaultAlerts {

    private const val CHANNEL_ID = "vault_alerts"
    private const val CHANNEL_NAME = "Alerts"

    fun notify(context: Context, label: String?) {
        if (label.isNullOrBlank()) return
        if (!canPost(context)) return

        ensureChannel(context)

        val tapIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pending = PendingIntent.getActivity(
            context,
            label.hashCode(),
            tapIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = Notification.Builder(context, CHANNEL_ID)
            .setContentTitle(label)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .build()

        val mgr = context.getSystemService(NotificationManager::class.java)
        // Unique id so repeat alerts stack rather than overwrite.
        val id = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        runCatching { mgr.notify(id, notification) }
    }

    private fun ensureChannel(context: Context) {
        val mgr = context.getSystemService(NotificationManager::class.java)
        if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            mgr.createNotificationChannel(channel)
        }
    }

    private fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }
}
