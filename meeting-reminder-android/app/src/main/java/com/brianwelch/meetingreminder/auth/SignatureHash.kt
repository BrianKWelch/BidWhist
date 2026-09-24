package com.brianwelch.meetingreminder.auth

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import java.security.MessageDigest

/**
 * Base64(SHA-1) of the certificate that signed the installed APK. MSAL requires
 * the redirect URI to be msauth://<package>/<this value>, and Entra must have
 * exactly that URI registered. Computing it at runtime means the setup screen
 * always shows the right value, whichever key signed this build.
 */
object SignatureHash {

    fun of(context: Context): String {
        val pm = context.packageManager
        val info = if (Build.VERSION.SDK_INT >= 33) {
            pm.getPackageInfo(
                context.packageName,
                PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES.toLong()),
            )
        } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        }
        val signing = checkNotNull(info.signingInfo) { "APK has no signing info" }
        val signatures = if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        val cert = signatures.first().toByteArray()
        val digest = MessageDigest.getInstance("SHA-1").digest(cert)
        return Base64.encodeToString(digest, Base64.NO_WRAP)
    }
}
