package com.brianwelch.meetingreminder.reminders

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.text.format.DateFormat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.brianwelch.meetingreminder.R
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.time.TimeText
import com.brianwelch.meetingreminder.ui.MainActivity
import java.time.Instant
import java.time.ZoneId

class ReminderNotifier(private val context: Context) {

    fun ensureChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.channel_name),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.channel_description)
            enableVibration(true)
            setShowBadge(true)
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun notificationsAllowed(): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        val nm = NotificationManagerCompat.from(context)
        if (!nm.areNotificationsEnabled()) return false
        val channel = context.getSystemService(NotificationManager::class.java).getNotificationChannel(CHANNEL_ID)
        return channel == null || channel.importance != NotificationManager.IMPORTANCE_NONE
    }

    /**
     * "Meeting in 15 minutes" / "Project COBRA Weekly Touchpoint" / "10:00 AM".
     * Text is computed now, in the phone's zone at this moment, so a late
     * delivery or a trip across time zones still reads correctly.
     */
    fun show(r: ReminderEntity, now: Instant) {
        val zone = ZoneId.systemDefault()
        val use24h = DateFormat.is24HourFormat(context)
        val start = Instant.ofEpochMilli(r.startUtcMillis)
        val end = Instant.ofEpochMilli(r.endUtcMillis)
        val timeLine = TimeText.time(start, zone, use24h) + " " + TimeText.zoneAbbreviation(zone, start)
        val notificationId = notificationId(r.id)

        val open = PendingIntent.getActivity(
            context, notificationId,
            Intent(context, MainActivity::class.java)
                .setAction(ACTION_OPEN_MEETING)
                .putExtra(EXTRA_EVENT_ID, r.eventId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(ReminderMath.notificationTitle(start, now))
            .setContentText(r.title)
            .setSubText(timeLine)
            .setStyle(NotificationCompat.BigTextStyle().bigText("${r.title}\n$timeLine"))
            .setWhen(r.startUtcMillis)
            .setShowWhen(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(open)

        // Clear the notification once the meeting is over.
        val untilEnd = end.toEpochMilli() - now.toEpochMilli()
        if (untilEnd > 0) builder.setTimeoutAfter(untilEnd)

        r.joinUrl?.let { url ->
            val join = PendingIntent.getActivity(
                context, notificationId,
                JoinMeetingActivity.intent(context, url, notificationId),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            builder.addAction(0, "JOIN MEETING", join)
        }

        post(notificationId, builder)
    }

    fun showTest() {
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Test reminder")
            .setContentText("Reminders are working on this phone.")
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
        post(TEST_NOTIFICATION_ID, builder)
    }

    fun cancel(reminderId: Long) {
        NotificationManagerCompat.from(context).cancel(notificationId(reminderId))
    }

    private fun post(id: Int, builder: NotificationCompat.Builder) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build())
        } catch (_: SecurityException) {
            // Permission revoked between the check and the call; nothing else to do.
        }
    }

    companion object {
        const val CHANNEL_ID = "meeting_reminders"
        const val ACTION_OPEN_MEETING = "com.brianwelch.meetingreminder.OPEN_MEETING"
        const val EXTRA_EVENT_ID = "eventId"
        private const val TEST_NOTIFICATION_ID = 0x7FFFFFF0

        fun notificationId(reminderId: Long): Int = (reminderId and 0x7FFFFFFF).toInt()
    }
}
