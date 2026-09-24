package com.brianwelch.meetingreminder.ui

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.brianwelch.meetingreminder.AppGraph
import com.brianwelch.meetingreminder.auth.AuthManager
import com.brianwelch.meetingreminder.auth.AuthRequiredException
import com.brianwelch.meetingreminder.auth.SignInResult
import com.brianwelch.meetingreminder.data.AppSettings
import com.brianwelch.meetingreminder.data.ReminderEntity
import com.brianwelch.meetingreminder.graph.GraphClient
import com.brianwelch.meetingreminder.model.Meeting
import com.brianwelch.meetingreminder.reminders.ReminderMath
import com.microsoft.identity.client.exception.MsalException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.IOException
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

sealed interface Session {
    data object Loading : Session
    data object NeedsSetup : Session
    data object SignedOut : Session
    data class SignedIn(val username: String, val accountId: String, val needsReauth: Boolean = false) : Session
}

data class UiState(
    val session: Session = Session.Loading,
    val loading: Boolean = false,
    val meetings: List<Meeting> = emptyList(),
    val lastRefreshed: Instant? = null,
    val error: String? = null,
    val signingIn: Boolean = false,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val graph = AppGraph.get(application)
    private val auth = graph.auth

    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    val settings: StateFlow<AppSettings?> =
        graph.settings.settings.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val reminders: StateFlow<List<ReminderEntity>> =
        graph.reminders.reminders.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val messages: SharedFlow<String> = _messages

    /** Event id to open in the details screen (set when a notification is tapped). */
    val openEventId = MutableStateFlow<String?>(null)

    val redirectUri: String get() = auth.redirectUri
    val signatureHash: String get() = auth.signatureHash

    private val graphClient = GraphClient {
        val s = graph.settings.current()
        auth.accessToken(s.clientId, s.tenantId)
    }

    init {
        viewModelScope.launch { loadSession(refreshAfter = true) }
    }

    private suspend fun loadSession(refreshAfter: Boolean) {
        val s = graph.settings.current()
        if (!s.isConfigured) {
            _state.update { it.copy(session = Session.NeedsSetup) }
            return
        }
        val session = try {
            auth.currentAccount(s.clientId, s.tenantId)
                ?.let { Session.SignedIn(it.username ?: "Microsoft 365 account", it.id) }
                ?: Session.SignedOut
        } catch (e: MsalException) {
            _state.update { it.copy(error = AuthManager.describe(e)) }
            Session.SignedOut
        } catch (e: Exception) {
            _state.update { it.copy(error = "Could not start Microsoft sign-in: ${e.message}") }
            Session.SignedOut
        }
        _state.update { it.copy(session = session) }
        if (refreshAfter && session is Session.SignedIn) refresh()
    }

    /** Called whenever the app comes to the foreground; skips if data is under a minute old. */
    fun onForeground() {
        val st = _state.value
        val fresh = st.lastRefreshed?.let { Duration.between(it, Instant.now()) < Duration.ofMinutes(1) } == true
        if (st.session is Session.SignedIn && !fresh) refresh()
    }

    fun saveSetup(clientId: String, tenantId: String) = viewModelScope.launch {
        val old = graph.settings.current()
        if (old.isConfigured && (old.clientId != clientId.trim() || old.tenantId != tenantId.trim())) {
            auth.signOut(old.clientId, old.tenantId)
        }
        graph.settings.setAuth(clientId, tenantId)
        _state.update { UiState(session = Session.Loading) }
        loadSession(refreshAfter = true)
    }

    fun setExtraZones(zones: Set<String>) = viewModelScope.launch { graph.settings.setExtraZones(zones) }

    fun signIn(activity: Activity) = viewModelScope.launch {
        val s = graph.settings.current()
        _state.update { it.copy(signingIn = true, error = null) }
        when (val result = auth.signIn(activity, s.clientId, s.tenantId)) {
            is SignInResult.Success -> {
                _state.update {
                    it.copy(signingIn = false, session = Session.SignedIn(result.account.username ?: "", result.account.id))
                }
                refresh()
            }
            SignInResult.Cancelled -> _state.update { it.copy(signingIn = false) }
            is SignInResult.Failed -> _state.update { it.copy(signingIn = false, error = result.message) }
        }
    }

    fun signOut() = viewModelScope.launch {
        val s = graph.settings.current()
        auth.signOut(s.clientId, s.tenantId)
        // Reminders already set stay armed: they are local and need no account to fire.
        _state.update { UiState(session = Session.SignedOut) }
    }

    fun refresh() {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                val zone = ZoneId.systemDefault()
                val startOfToday = Instant.now().atZone(zone).toLocalDate().atStartOfDay(zone)
                val meetings = graphClient.calendarView(startOfToday.toInstant(), startOfToday.plusDays(8).toInstant())
                _state.update {
                    val session = (it.session as? Session.SignedIn)?.copy(needsReauth = false) ?: it.session
                    it.copy(meetings = meetings, lastRefreshed = Instant.now(), session = session)
                }
                graph.reminders.sync(meetings) { id -> graphClient.event(id) }
            } catch (e: AuthRequiredException) {
                _state.update {
                    val session = (it.session as? Session.SignedIn)?.copy(needsReauth = true) ?: Session.SignedOut
                    it.copy(session = session)
                }
            } catch (e: IOException) {
                _state.update { it.copy(error = e.message?.takeIf { m -> m.startsWith("Microsoft") } ?: "Can't reach Microsoft 365. Check your connection and try again.") }
            } catch (e: MsalException) {
                _state.update { it.copy(error = AuthManager.describe(e)) }
            } finally {
                _state.update { it.copy(loading = false) }
            }
        }
    }

    /** Returns null on success, or a message explaining why the time was rejected. */
    fun setReminder(meeting: Meeting, remindAt: Instant, offsetMinutes: Int?, onDone: (String?) -> Unit) {
        viewModelScope.launch {
            val accountId = (_state.value.session as? Session.SignedIn)?.accountId ?: ""
            val error = try {
                graph.reminders.set(meeting, remindAt, offsetMinutes, accountId)
                null
            } catch (e: IllegalArgumentException) {
                e.message ?: "Could not set the reminder."
            }
            onDone(error)
        }
    }

    fun setPresetReminder(meeting: Meeting, offsetMinutes: Int, onDone: (String?) -> Unit) =
        setReminder(meeting, ReminderMath.remindAt(meeting.start, offsetMinutes), offsetMinutes, onDone)

    fun deleteReminder(eventId: String) = viewModelScope.launch {
        graph.reminders.delete(eventId)
        _messages.tryEmit("Reminder deleted")
    }

    fun sendTestNotification() {
        graph.scheduler.scheduleTest(delaySeconds = 10)
        _messages.tryEmit("Test notification in 10 seconds. Lock the phone to check it wakes.")
    }

    fun clearError() = _state.update { it.copy(error = null) }

    fun canScheduleExact(): Boolean = graph.scheduler.canScheduleExact()
    fun notificationsAllowed(): Boolean = graph.notifier.notificationsAllowed()
}
