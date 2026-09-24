package com.brianwelch.meetingreminder.auth

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.UUID

/**
 * Builds the MSAL configuration at runtime, so the client ID can be typed into
 * the app instead of compiled in, and the redirect URI always matches the
 * certificate that actually signed the installed APK.
 */
object AuthConfig {

    /**
     * The only permission requested. Read-only: Graph rejects any write to the
     * calendar made with this token. openid/profile/offline_access are added by MSAL.
     */
    val SCOPES: List<String> = listOf("https://graph.microsoft.com/Calendars.Read")

    const val GRAPH_BASE = "https://graph.microsoft.com/v1.0"

    fun redirectUri(packageName: String, signatureHash: String): String =
        "msauth://$packageName/${URLEncoder.encode(signatureHash, "UTF-8")}"

    fun isValidClientId(clientId: String): Boolean =
        runCatching { UUID.fromString(clientId.trim()) }.isSuccess && clientId.trim().length == 36

    /** Blank, "organizations", a GUID or a verified domain such as contoso.com. */
    fun isValidTenant(tenant: String): Boolean {
        val t = tenant.trim()
        if (t.isEmpty() || t.equals("organizations", true)) return true
        if (runCatching { UUID.fromString(t) }.isSuccess && t.length == 36) return true
        return Regex("""^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$""").matches(t)
    }

    fun json(clientId: String, tenant: String, packageName: String, signatureHash: String): String {
        val t = tenant.trim()
        val audience = if (t.isEmpty() || t.equals("organizations", true)) {
            // Any work/school account; the Entra app must be registered as multitenant.
            JSONObject().put("type", "AzureADMultipleOrgs")
        } else {
            // Only accounts in one tenant (the usual setup for a firm's own registration).
            JSONObject().put("type", "AzureADMyOrg").put("tenant_id", t)
        }
        return JSONObject()
            .put("client_id", clientId.trim())
            .put("redirect_uri", redirectUri(packageName, signatureHash))
            .put("account_mode", "SINGLE")
            // DEFAULT = Microsoft Authenticator / Company Portal broker when installed
            // (needed for Conditional Access / compliant-device policies), otherwise
            // the system browser. Never an embedded WebView.
            .put("authorization_user_agent", "DEFAULT")
            .put("broker_redirect_uri_registered", true)
            .put(
                "authorities",
                JSONArray().put(JSONObject().put("type", "AAD").put("audience", audience).put("default", true)),
            )
            .toString(2)
    }
}
