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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Section 8: a FOREGROUND_SERVICE_SPECIAL_USE service that keeps the MMS
 * ContentObserver alive under One UI's aggressive background limits.
 *
 * The notification is deliberately minimal and low priority. It is the ONLY
 * notification this app posts; it never announces a captured message.
 */
class ObserverService : Service() {

    private var observer: MmsObserver? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        // Register the MMS observer FIRST so capture works even if the platform
        // refuses to promote us to the foreground. Its register() also runs an
        // immediate sweep, so any MMS already received is captured retroactively.
        observer = MmsObserver(applicationContext).also { runCatching { it.register() } }
        // Then try to become a foreground service for background longevity. If the
        // platform refuses (e.g. a background start), keep running rather than
        // stopping — never kill capture just because we could not go foreground.
        runCatching { startInForeground() }
        startPeriodicSweep()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Every start (including each app open) forces an immediate rescan, so a
        // missed change-notification does not mean a missed MMS.
        runCatching { observer?.triggerSweep() }
        // Sticky so the platform restarts us after a kill.
        return START_STICKY
    }

    /**
     * Backstop poll: One UI does not reliably fire the ContentObserver for an
     * incoming MMS, so sweep on a fixed interval as well. MMS already lags the
     * default app by seconds, so a short poll is within the expected latency.
     */
    private fun startPeriodicSweep() {
        scope.launch {
            while (isActive) {
                delay(SWEEP_INTERVAL_MS)
                runCatching { observer?.triggerSweep() }
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
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
        private const val SWEEP_INTERVAL_MS = 45_000L

        fun start(context: Context) {
            val intent = Intent(context, ObserverService::class.java)
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }
        }
    }
}
