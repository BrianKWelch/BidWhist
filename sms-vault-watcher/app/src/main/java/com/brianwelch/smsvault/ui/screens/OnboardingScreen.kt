package com.brianwelch.smsvault.ui.screens

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.brianwelch.smsvault.mms.ObserverService
import com.brianwelch.smsvault.util.PermissionState

/**
 * Section 9 onboarding. A live checklist with a grant action per row:
 * SMS/MMS/contacts/notifications runtime permissions, notification-listener
 * access, battery-unrestricted, and biometric enrollment. Setup is "complete"
 * only when every row is green (spec 5 requires verifying notification access
 * before declaring setup done).
 */
@Composable
fun OnboardingScreen(
    activity: FragmentActivity,
    onEnterVault: () -> Unit,
    onManageNumbers: () -> Unit
) {
    val context = LocalContext.current
    // A counter we bump to force re-evaluation of the (non-observable) grant
    // checks; each derived value recomputes when it changes.
    var refresh by remember { mutableIntStateOf(0) }

    // Re-check grant status whenever we return to this screen, so permissions
    // granted manually in Settings are reflected without relaunching the app.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) refresh++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val smsGranted = remember(refresh) { PermissionState.smsPermissionsGranted(context) }
    val notifGranted = remember(refresh) { PermissionState.notificationAccessGranted(context) }
    val batteryOk = remember(refresh) { PermissionState.batteryUnrestricted(context) }
    val biometricOk = remember(refresh) { PermissionState.biometricEnrolled(activity) }
    val allGood = smsGranted && notifGranted && biometricOk

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        refresh++
        // Starting the foreground service can throw on newer Android if the app
        // is not in an allowed state; never let that crash setup.
        if (PermissionState.smsPermissionsGranted(context)) {
            runCatching { ObserverService.start(context) }
        }
    }
    val settingsLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { refresh++ }

    // Launch helpers that never crash the app if an Intent cannot be resolved on
    // this device (some Settings deep-links vary by OEM / OS build).
    fun launchSettings(intent: Intent, fallbackMessage: String) {
        runCatching { settingsLauncher.launch(intent) }
            .onFailure { Toast.makeText(context, fallbackMessage, Toast.LENGTH_LONG).show() }
    }
    fun requestRuntimePermissions() {
        runCatching { permissionLauncher.launch(PermissionState.RUNTIME_PERMISSIONS) }
            .onFailure {
                Toast.makeText(
                    context,
                    "Grant SMS, Contacts and Notifications in Settings > Apps > Vault > Permissions.",
                    Toast.LENGTH_LONG
                ).show()
            }
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp)
    ) {
        Text("Vault setup", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            "Grant each item below. The archival observer only runs once SMS and " +
                "notification access are on.",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(Modifier.height(16.dp))

        ChecklistRow(
            title = "SMS, MMS & contacts permissions",
            granted = smsGranted,
            actionLabel = "Grant"
        ) { requestRuntimePermissions() }

        ChecklistRow(
            title = "Notification access (to dismiss inbound alerts)",
            granted = notifGranted,
            actionLabel = "Open settings"
        ) {
            launchSettings(
                Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS),
                "Open Settings > Notifications > Notification access, then enable Vault."
            )
        }

        ChecklistRow(
            title = "Battery: Unrestricted / never sleeping",
            granted = batteryOk,
            actionLabel = "Fix"
        ) {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:${context.packageName}"))
            } else {
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:${context.packageName}"))
            }
            launchSettings(intent, "Open Settings > Apps > Vault > Battery and set Unrestricted.")
        }

        ChecklistRow(
            title = "Biometric or device credential enrolled",
            granted = biometricOk,
            actionLabel = "Enroll"
        ) {
            val enroll = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Intent(Settings.ACTION_BIOMETRIC_ENROLL)
            } else {
                Intent(Settings.ACTION_SECURITY_SETTINGS)
            }
            launchSettings(enroll, "Open Settings > Security to enroll a fingerprint or screen lock.")
        }

        Spacer(Modifier.height(12.dp))
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp)) {
                Text("Samsung background steps", style = MaterialTheme.typography.titleSmall)
                Text(
                    "1. Settings > Apps > Vault > Battery > Unrestricted\n" +
                        "2. Settings > Battery > Background usage limits > Never sleeping apps > add Vault\n" +
                        "3. Settings > Security and Privacy > Auto Blocker > off (only needed for the sideload)",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }
        }

        Spacer(Modifier.height(20.dp))
        OutlinedButton(onClick = onManageNumbers, modifier = Modifier.fillMaxWidth()) {
            Text("Manage watched numbers")
        }
        Spacer(Modifier.height(10.dp))
        Button(
            onClick = onEnterVault,
            enabled = allGood,
            modifier = Modifier.fillMaxWidth()
        ) { Text(if (allGood) "Enter vault" else "Complete setup to continue") }
    }
}

@Composable
private fun ChecklistRow(
    title: String,
    granted: Boolean,
    actionLabel: String,
    onAction: () -> Unit
) {
    Card(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        Row(
            Modifier.padding(14.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Icon(
                    imageVector = if (granted) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (granted) Color(0xFF2E7D32) else MaterialTheme.colorScheme.outline
                )
                Spacer(Modifier.height(0.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(start = 12.dp)
                )
            }
            if (!granted) {
                Button(onClick = onAction) { Text(actionLabel) }
            }
        }
    }
}
