package com.brianwelch.meetingreminder.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.brianwelch.meetingreminder.AppGraph
import kotlinx.coroutines.launch

/** Delivered by AlarmManager at the reminder time, even when the app is not running. */
class ReminderAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val graph = AppGraph.get(context)
        val pending = goAsync()
        graph.scope.launch {
            try {
                when (intent.action) {
                    ACTION_FIRE -> {
                        val id = intent.getLongExtra(EXTRA_REMINDER_ID, -1L)
                        if (id >= 0) graph.reminders.onAlarm(id)
                    }
                    ACTION_TEST -> graph.notifier.showTest()
                }
            } catch (e: Exception) {
                Log.e("ReminderAlarmReceiver", "Failed to handle alarm", e)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_FIRE = "com.brianwelch.meetingreminder.FIRE_REMINDER"
        const val ACTION_TEST = "com.brianwelch.meetingreminder.TEST_REMINDER"
        const val EXTRA_REMINDER_ID = "reminderId"
    }
}

/**
 * Re-arms alarms whenever the system may have dropped or shifted them:
 * reboot, app update, manual clock change, time zone change, and the
 * exact-alarm permission being granted.
 *
 * Time zone and DST changes need no recalculation (everything is stored as a
 * UTC instant); re-arming is simply a cheap safety net.
 */
class SystemEventsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in HANDLED) return
        val graph = AppGraph.get(context)
        val pending = goAsync()
        graph.scope.launch {
            try {
                graph.reminders.rearmAll()
            } catch (e: Exception) {
                Log.e("SystemEventsReceiver", "Failed to re-arm reminders", e)
            } finally {
                pending.finish()
            }
        }
    }

    private companion object {
        val HANDLED = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
        )
    }
}
