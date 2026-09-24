package com.brianwelch.meetingreminder.auth

import android.app.Activity
import android.content.Context
import com.microsoft.identity.client.AcquireTokenParameters
import com.microsoft.identity.client.AcquireTokenSilentParameters
import com.microsoft.identity.client.AuthenticationCallback
import com.microsoft.identity.client.IAccount
import com.microsoft.identity.client.IAuthenticationResult
import com.microsoft.identity.client.ISingleAccountPublicClientApplication
import com.microsoft.identity.client.PublicClientApplication
import com.microsoft.identity.client.SignInParameters
import com.microsoft.identity.client.exception.MsalException
import com.microsoft.identity.client.exception.MsalUiRequiredException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume

/** Thrown when Microsoft 365 needs the user to sign in again (expired/revoked session, MFA, consent). */
class AuthRequiredException(cause: Throwable? = null) : Exception("Microsoft 365 sign-in required", cause)

sealed interface SignInResult {
    data class Success(val account: IAccount) : SignInResult
    data object Cancelled : SignInResult
    data class Failed(val message: String) : SignInResult
}

/**
 * Thin wrapper over MSAL single-account mode.
 *
 * Security notes:
 *  - Authorization code + PKCE via the Microsoft Authenticator broker or the system
 *    browser. The app never sees the password.
 *  - Tokens live only in MSAL's cache, encrypted with an Android Keystore key.
 *  - No client secret exists: this is a public client.
 */
class AuthManager(private val context: Context) {

    private val mutex = Mutex()
    private var app: ISingleAccountPublicClientApplication? = null
    private var appKey: String? = null

    val signatureHash: String by lazy { SignatureHash.of(context) }
    val redirectUri: String by lazy { AuthConfig.redirectUri(context.packageName, signatureHash) }

    private suspend fun app(clientId: String, tenantId: String): ISingleAccountPublicClientApplication =
        mutex.withLock {
            val key = "$clientId|$tenantId"
            app?.takeIf { appKey == key }?.let { return it }
            withContext(Dispatchers.IO) {
                val config = File(context.noBackupFilesDir, "msal_config.json")
                config.writeText(AuthConfig.json(clientId, tenantId, context.packageName, signatureHash))
                PublicClientApplication.createSingleAccountPublicClientApplication(context, config)
            }.also {
                app = it
                appKey = key
            }
        }

    suspend fun currentAccount(clientId: String, tenantId: String): IAccount? = withContext(Dispatchers.IO) {
        app(clientId, tenantId).currentAccount?.currentAccount
    }

    /**
     * Interactive sign-in. If an account is already known (expired session) it
     * re-authenticates that account instead of starting a fresh sign-in, which
     * MSAL single-account mode would reject.
     */
    suspend fun signIn(activity: Activity, clientId: String, tenantId: String): SignInResult {
        val pca = try {
            app(clientId, tenantId)
        } catch (e: MsalException) {
            return SignInResult.Failed(describe(e))
        }
        val existing = runCatching { withContext(Dispatchers.IO) { pca.currentAccount?.currentAccount } }.getOrNull()

        return withContext(Dispatchers.Main) {
            suspendCancellableCoroutine { cont ->
                val callback = object : AuthenticationCallback {
                    override fun onSuccess(result: IAuthenticationResult) {
                        if (cont.isActive) cont.resume(SignInResult.Success(result.account))
                    }
                    override fun onError(e: MsalException) {
                        if (cont.isActive) cont.resume(SignInResult.Failed(describe(e)))
                    }
                    override fun onCancel() {
                        if (cont.isActive) cont.resume(SignInResult.Cancelled)
                    }
                }
                if (existing == null) {
                    pca.signIn(
                        SignInParameters.builder()
                            .withActivity(activity)
                            .withScopes(AuthConfig.SCOPES)
                            .withCallback(callback)
                            .build(),
                    )
                } else {
                    pca.acquireToken(
                        AcquireTokenParameters.Builder()
                            .startAuthorizationFromActivity(activity)
                            .forAccount(existing)
                            .withScopes(AuthConfig.SCOPES)
                            .withCallback(callback)
                            .build(),
                    )
                }
            }
        }
    }

    /** Access token for Graph, refreshed silently by MSAL when needed. */
    suspend fun accessToken(clientId: String, tenantId: String): String = withContext(Dispatchers.IO) {
        val pca = app(clientId, tenantId)
        val account = pca.currentAccount?.currentAccount ?: throw AuthRequiredException()
        try {
            pca.acquireTokenSilent(
                AcquireTokenSilentParameters.Builder()
                    .forAccount(account)
                    .fromAuthority(account.authority)
                    .withScopes(AuthConfig.SCOPES)
                    .build(),
            ).accessToken
        } catch (e: MsalUiRequiredException) {
            throw AuthRequiredException(e)
        }
    }

    suspend fun signOut(clientId: String, tenantId: String) = withContext(Dispatchers.IO) {
        runCatching { app(clientId, tenantId).signOut() }
        Unit
    }

    companion object {
        fun describe(e: MsalException): String {
            val code = e.errorCode.orEmpty()
            val msg = e.message.orEmpty()
            return when {
                msg.contains("AADSTS65001") || msg.contains("consent", true) ->
                    "Your organization requires an administrator to approve this app (Calendars.Read). See README, section \"Admin consent\"."
                msg.contains("AADSTS50011") || code.contains("redirect", true) ->
                    "Redirect URI mismatch. Copy the redirect URI from Settings into the Entra app registration."
                msg.contains("AADSTS700016") ->
                    "Application (client) ID not found in this tenant. Check the client ID and tenant ID."
                msg.contains("AADSTS50194") ->
                    "The app registration is single-tenant. Enter your Directory (tenant) ID in Settings."
                code == "no_network" || code == "device_network_not_available" ->
                    "No network connection."
                else -> "Sign-in failed: ${if (msg.isNotBlank()) msg.take(300) else code}"
            }
        }
    }
}
