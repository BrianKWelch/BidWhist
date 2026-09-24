package com.brianwelch.meetingreminder.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.brianwelch.meetingreminder.reminders.ReminderNotifier
import com.brianwelch.meetingreminder.ui.theme.MeetingReminderTheme

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Only on a fresh start: after a fold/unfold recreate, the old intent must not reopen the details screen.
        if (savedInstanceState == null) handleIntent(intent)
        setContent {
            MeetingReminderTheme {
                AppRoot(viewModel, activity = this)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        // V1 sync policy: refresh meetings (and re-check reminded meetings) each time the app opens.
        viewModel.onForeground()
    }

    private fun handleIntent(intent: Intent?) {
        if (intent?.action == ReminderNotifier.ACTION_OPEN_MEETING) {
            intent.getStringExtra(ReminderNotifier.EXTRA_EVENT_ID)?.let { viewModel.openEventId.value = it }
        }
    }
}
