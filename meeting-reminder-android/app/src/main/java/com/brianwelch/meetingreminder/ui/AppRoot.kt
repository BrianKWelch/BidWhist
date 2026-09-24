package com.brianwelch.meetingreminder.ui

import android.Manifest
import android.app.Activity
import android.os.Build
import android.text.format.DateFormat
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.brianwelch.meetingreminder.data.ReminderStatus
import com.brianwelch.meetingreminder.model.Meeting

private enum class Tab { MEETINGS, REMINDERS }
private enum class Page { MAIN, SETTINGS, DETAILS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppRoot(vm: MainViewModel, activity: Activity) {
    val state by vm.state.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val reminders by vm.reminders.collectAsStateWithLifecycle()
    val openEventId by vm.openEventId.collectAsStateWithLifecycle()
    val clock by rememberClock()
    val context = LocalContext.current
    val use24h = DateFormat.is24HourFormat(context)

    var tab by rememberSaveable { mutableStateOf(Tab.MEETINGS) }
    var page by rememberSaveable { mutableStateOf(Page.MAIN) }
    var detailsEventId by rememberSaveable { mutableStateOf<String?>(null) }
    var sheetMeeting by remember { mutableStateOf<Meeting?>(null) }
    val snackbar = remember { SnackbarHostState() }

    var reliability by remember { mutableStateOf(Reliability.read(context, vm)) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { reliability = Reliability.read(context, vm) }
    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        reliability = Reliability.read(context, vm)
    }
    val requestNotifications: () -> Unit = {
        if (Build.VERSION.SDK_INT >= 33) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            SystemSettings.notifications(context)
        }
    }

    LaunchedEffect(openEventId) {
        openEventId?.let {
            detailsEventId = it
            page = Page.DETAILS
            vm.openEventId.value = null
        }
    }
    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }

    BackHandler(enabled = page != Page.MAIN) { page = Page.MAIN }

    val s = settings
    val extraZones = s?.extraZones?.toList().orEmpty()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (page) {
                            Page.SETTINGS -> "Settings"
                            Page.DETAILS -> "Meeting"
                            Page.MAIN -> if (tab == Tab.MEETINGS) "Meetings" else "My Reminders"
                        },
                    )
                },
                navigationIcon = {
                    if (page != Page.MAIN) {
                        IconButton(onClick = { page = Page.MAIN }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                actions = {
                    if (page == Page.MAIN && state.session is Session.SignedIn) {
                        if (state.loading) {
                            CircularProgressIndicator(Modifier.padding(12.dp).size(24.dp), strokeWidth = 2.dp)
                        } else {
                            IconButton(onClick = { vm.refresh() }) { Icon(Icons.Filled.Refresh, contentDescription = "Refresh") }
                        }
                    }
                    if (page == Page.MAIN) {
                        IconButton(onClick = { page = Page.SETTINGS }) { Icon(Icons.Filled.Settings, contentDescription = "Settings") }
                    }
                },
            )
        },
        bottomBar = {
            if (page == Page.MAIN && state.session is Session.SignedIn) {
                NavigationBar {
                    NavigationBarItem(
                        selected = tab == Tab.MEETINGS,
                        onClick = { tab = Tab.MEETINGS },
                        icon = { Icon(Icons.Filled.DateRange, contentDescription = null) },
                        label = { Text("Meetings") },
                    )
                    val scheduled = reminders.count { it.status == ReminderStatus.SCHEDULED }
                    val attention = reminders.count {
                        it.status == ReminderStatus.MEETING_CANCELLED || it.status == ReminderStatus.MISSED
                    }
                    NavigationBarItem(
                        selected = tab == Tab.REMINDERS,
                        onClick = { tab = Tab.REMINDERS },
                        icon = {
                            BadgedBox(badge = {
                                if (attention > 0) Badge { Text("!") } else if (scheduled > 0) Badge { Text("$scheduled") }
                            }) { Icon(Icons.Filled.Notifications, contentDescription = null) }
                        },
                        label = { Text("My Reminders") },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        // Content is capped at 720dp and centred so the unfolded Z Fold screen stays readable.
        Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.widthIn(max = 720.dp).fillMaxSize()) {
                when {
                    s == null || state.session == Session.Loading ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }

                    page == Page.SETTINGS -> SettingsContent(
                        vm, s, state.session, reliability, clock,
                        onRequestNotifications = requestNotifications,
                        onSignIn = { page = Page.MAIN; vm.signIn(activity) },
                    )

                    state.session == Session.NeedsSetup -> SetupScreen(vm, s.clientId, s.tenantId)

                    state.session == Session.SignedOut && page != Page.DETAILS -> SignInScreen(
                        signingIn = state.signingIn,
                        error = state.error,
                        onSignIn = { vm.signIn(activity) },
                        onSettings = { page = Page.SETTINGS },
                    )

                    page == Page.DETAILS -> {
                        val id = detailsEventId
                        val reminder = reminders.firstOrNull { it.eventId == id }
                        val meeting = state.meetings.firstOrNull { it.id == id } ?: reminder?.toMeeting()
                        MeetingDetailContent(
                            meeting, reminder, clock, use24h, extraZones,
                            onSetReminder = { sheetMeeting = it },
                            onDelete = { vm.deleteReminder(it) },
                        )
                    }

                    else -> {
                        MainBanners(
                            state = state,
                            reliability = reliability,
                            hasScheduled = reminders.any { it.status == ReminderStatus.SCHEDULED },
                            onSignIn = { vm.signIn(activity) },
                            onDismissError = { vm.clearError() },
                            onFixNotifications = requestNotifications,
                            onOpenSettings = { page = Page.SETTINGS },
                        )
                        when (tab) {
                            Tab.MEETINGS -> MeetingsScreen(
                                state.meetings, reminders, state.loading, state.lastRefreshed,
                                clock, use24h, extraZones,
                                onMeetingClick = { sheetMeeting = it },
                            )
                            Tab.REMINDERS -> MyRemindersScreen(
                                reminders, clock, use24h,
                                onOpen = { detailsEventId = it.eventId; page = Page.DETAILS },
                                onChange = { r ->
                                    sheetMeeting = state.meetings.firstOrNull { it.id == r.eventId } ?: r.toMeeting()
                                },
                                onDelete = { vm.deleteReminder(it.eventId) },
                            )
                        }
                    }
                }
            }
        }
    }

    sheetMeeting?.let { meeting ->
        RemindMeSheet(
            meeting = meeting,
            existing = reminders.firstOrNull { it.eventId == meeting.id },
            clock = clock,
            use24h = use24h,
            extraZones = extraZones,
            onPreset = { minutes, done -> vm.setPresetReminder(meeting, minutes, done) },
            onCustom = { at, offset, done -> vm.setReminder(meeting, at, offset, done) },
            onDelete = { vm.deleteReminder(meeting.id) },
            // Ask for notification permission at the moment it is first needed.
            onSet = { if (!reliability.notifications) requestNotifications() },
            onDismiss = { sheetMeeting = null },
        )
    }
}

@Composable
private fun MainBanners(
    state: UiState,
    reliability: Reliability,
    hasScheduled: Boolean,
    onSignIn: () -> Unit,
    onDismissError: () -> Unit,
    onFixNotifications: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    Column(Modifier.fillMaxWidth()) {
        if ((state.session as? Session.SignedIn)?.needsReauth == true) {
            Banner("Microsoft 365 sign-in expired. Reminders already set still work.", "Sign in", onSignIn)
        }
        state.error?.let { Banner(it, onDismiss = onDismissError) }
        if (hasScheduled && !reliability.notifications) {
            Banner("Notifications are off, so reminders cannot appear.", "Allow", onFixNotifications)
        } else if (hasScheduled && !(reliability.exactAlarms && reliability.batteryUnrestricted)) {
            Banner("Reminders may be delayed by battery settings.", "Fix", onOpenSettings)
        }
    }
}
