package com.brianwelch.meetingreminder.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.brianwelch.meetingreminder.BuildConfig
import com.brianwelch.meetingreminder.auth.AuthConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

data class AppSettings(
    val clientId: String,
    val tenantId: String,
    /** IANA ids from TimeText.EXTRA_ZONES the user switched on. */
    val extraZones: Set<String>,
) {
    val isConfigured: Boolean get() = AuthConfig.isValidClientId(clientId) && AuthConfig.isValidTenant(tenantId)
}

/** Small, non-secret preferences. Tokens are never stored here; MSAL keeps its own encrypted cache. */
class SettingsStore(private val context: Context) {

    private val clientIdKey = stringPreferencesKey("client_id")
    private val tenantIdKey = stringPreferencesKey("tenant_id")
    private val zonesKey = stringSetPreferencesKey("extra_zones")

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            clientId = p[clientIdKey] ?: BuildConfig.DEFAULT_CLIENT_ID,
            tenantId = p[tenantIdKey] ?: BuildConfig.DEFAULT_TENANT_ID,
            extraZones = p[zonesKey] ?: setOf("America/New_York"),
        )
    }

    suspend fun current(): AppSettings = settings.first()

    suspend fun setAuth(clientId: String, tenantId: String) {
        context.dataStore.edit {
            it[clientIdKey] = clientId.trim()
            it[tenantIdKey] = tenantId.trim()
        }
    }

    suspend fun setExtraZones(zones: Set<String>) {
        context.dataStore.edit { it[zonesKey] = zones }
    }
}
