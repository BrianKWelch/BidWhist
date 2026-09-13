package com.brianwelch.smsvault.mms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import com.brianwelch.smsvault.R

/**
 * Section 8: a FOREGROUND_SERVICE_SPECIAL_USE service that keeps the MMS
 * ContentObserver alive under One UI's aggressive background limits.
 *
 * The notification is deliberately minimal and low priority. It is the ONLY
 * notification this app posts; it never announces a captured message.
 */
class ObserverService : Service() {

    private var observer: MmsObserver? = null

    override fun onCreate() {
        super.onCreate()
        startInForeground()
        observer = MmsObserver(applicationContext).also { it.register() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Sticky so the platform restarts us after a kill.
        return START_STICKY
    }

    override fun onDestroy() {
        observer?.unregister()
        observer = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startInForeground() {
        createChannel()
        val notification: Notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.observer_notice))
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_MIN)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIF_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun createChannel() {
        val mgr = getSystemService(NotificationManager::class.java)
        if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.observer_channel_name),
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_SECRET
            }
            mgr.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val CHANNEL_ID = "observer_min"
        private const val NOTIF_ID = 42

        fun start(context: Context) {
            val intent = Intent(context, ObserverService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
