package com.brianwelch.meetingreminder.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneId

/** "Now" and the phone's zone, re-read every 30 s and on resume, so the UI follows travel live. */
data class Clock(val now: Instant, val zone: ZoneId)

@Composable
fun rememberClock(): State<Clock> {
    var resumeTick by remember { mutableStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { resumeTick++ }
    return produceState(Clock(Instant.now(), ZoneId.systemDefault()), resumeTick) {
        while (true) {
            value = Clock(Instant.now(), ZoneId.systemDefault())
            delay(30_000)
        }
    }
}

/** What stands between a scheduled reminder and a notification on this phone. */
data class Reliability(
    val notifications: Boolean,
    val exactAlarms: Boolean,
    val batteryUnrestricted: Boolean,
) {
    val allGood: Boolean get() = notifications && exactAlarms && batteryUnrestricted

    companion object {
        fun read(context: Context, vm: MainViewModel) = Reliability(
            notifications = vm.notificationsAllowed(),
            exactAlarms = vm.canScheduleExact(),
            batteryUnrestricted = context.getSystemService(PowerManager::class.java)
                .isIgnoringBatteryOptimizations(context.packageName),
        )
    }
}

/** Deep links into the system settings pages that matter for reliable reminders. */
object SystemSettings {

    fun notifications(context: Context) = launch(
        context,
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName),
    )

    fun exactAlarms(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            launch(context, Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
        }
    }

    /** One-tap system dialog: "Let app always run in background?" */
    fun unrestrictedBattery(context: Context) {
        val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        if (!launch(context, direct)) launch(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    /** App info page; on Samsung One UI this is where Battery > Unrestricted lives. */
    fun appDetails(context: Context) = launch(
        context,
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")),
    )

    private fun launch(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (_: ActivityNotFoundException) {
        false
    } catch (_: SecurityException) {
        false
    }
}
