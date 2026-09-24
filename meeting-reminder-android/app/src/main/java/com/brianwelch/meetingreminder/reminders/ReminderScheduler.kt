package com.brianwelch.meetingreminder.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log

/**
 * Arms and disarms AlarmManager alarms, one per reminder row.
 *
 * Why AlarmManager + setExactAndAllowWhileIdle:
 *  - Fires at an absolute UTC instant (RTC_WAKEUP), so time zone and DST changes
 *    cannot move it.
 *  - Wakes the phone from Doze. WorkManager and plain inexact alarms can be
 *    deferred by 10+ minutes in Doze, which defeats a "5 minutes before" reminder.
 *  - Runs with the app closed; the receiver is started by the system.
 * Alarms do not survive a reboot or a force-stop, so SystemEventsReceiver and
 * app start re-arm everything from the database.
 */
class ReminderScheduler(private val context: Context) {

    private val alarmManager = context.getSystemService(AlarmManager::class.java)

    /** False only if the user revoked "Alarms & reminders" (possible on Android 12/12L only). */
    fun canScheduleExact(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()

    fun schedule(reminderId: Long, atUtcMillis: Long) {
        armAt(atUtcMillis, pendingIntent(reminderId, ReminderAlarmReceiver.ACTION_FIRE, create = true)!!)
    }

    fun cancel(reminderId: Long) {
        pendingIntent(reminderId, ReminderAlarmReceiver.ACTION_FIRE, create = false)?.let {
            alarmManager.cancel(it)
            it.cancel()
        }
    }

    /** Arms a one-off test notification, delivered through the same alarm path as real reminders. */
    fun scheduleTest(delaySeconds: Int) {
        val at = System.currentTimeMillis() + delaySeconds * 1000L
        armAt(at, pendingIntent(TEST_ID, ReminderAlarmReceiver.ACTION_TEST, create = true)!!)
    }

    private fun armAt(atUtcMillis: Long, pi: PendingIntent) {
        if (canScheduleExact()) {
            try {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atUtcMillis, pi)
                return
            } catch (e: SecurityException) {
                Log.w(TAG, "Exact alarm refused; falling back to inexact", e)
            }
        }
        // Fallback: still wakes from Doze, but the system may deliver it several minutes late.
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atUtcMillis, pi)
    }

    private fun pendingIntent(id: Long, action: String, create: Boolean): PendingIntent? {
        val intent = Intent(context, ReminderAlarmReceiver::class.java)
            .setAction(action)
            // Distinct data URI per reminder keeps PendingIntents from ever colliding.
            .setData(Uri.parse("meetingreminder://reminder/$id"))
            .putExtra(ReminderAlarmReceiver.EXTRA_REMINDER_ID, id)
        val flags = PendingIntent.FLAG_IMMUTABLE or
            if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE
        return PendingIntent.getBroadcast(context, requestCode(id), intent, flags)
    }

    private fun requestCode(id: Long): Int = (id and 0x7FFFFFFF).toInt()

    companion object {
        private const val TAG = "ReminderScheduler"
        const val TEST_ID = 0x7FFFFFF0L
    }
}
