package com.brianwelch.meetingreminder

import android.content.Context
import com.brianwelch.meetingreminder.auth.AuthManager
import com.brianwelch.meetingreminder.data.AppDatabase
import com.brianwelch.meetingreminder.data.SettingsStore
import com.brianwelch.meetingreminder.reminders.ReminderNotifier
import com.brianwelch.meetingreminder.reminders.ReminderRepository
import com.brianwelch.meetingreminder.reminders.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Hand-wired singletons. Small enough that a DI framework would add more than it saves. */
class AppGraph private constructor(context: Context) {

    private val app = context.applicationContext

    /** Process-wide scope for receivers and start-up work. */
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val database: AppDatabase by lazy { AppDatabase.build(app) }
    val settings: SettingsStore by lazy { SettingsStore(app) }
    val scheduler: ReminderScheduler by lazy { ReminderScheduler(app) }
    val notifier: ReminderNotifier by lazy { ReminderNotifier(app) }
    val reminders: ReminderRepository by lazy { ReminderRepository(database.reminderDao(), scheduler, notifier) }
    val auth: AuthManager by lazy { AuthManager(app) }

    companion object {
        @Volatile private var instance: AppGraph? = null

        fun get(context: Context): AppGraph =
            instance ?: synchronized(this) { instance ?: AppGraph(context).also { instance = it } }
    }
}
