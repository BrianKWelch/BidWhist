package com.brianwelch.meetingreminder

import android.app.Application
import android.util.Log
import kotlinx.coroutines.launch

class MeetingReminderApp : Application() {

    override fun onCreate() {
        super.onCreate()
        val graph = AppGraph.get(this)
        graph.notifier.ensureChannel()
        // A force-stop or an OEM task killer wipes this app's alarms without any
        // broadcast. Re-arming on every process start closes that gap.
        graph.scope.launch {
            runCatching { graph.reminders.rearmAll() }
                .onFailure { Log.e("MeetingReminderApp", "Re-arm on start failed", it) }
        }
    }
}
