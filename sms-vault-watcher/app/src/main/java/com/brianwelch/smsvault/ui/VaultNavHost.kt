package com.brianwelch.smsvault.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.brianwelch.smsvault.ui.screens.DiagnosticScreen
import com.brianwelch.smsvault.ui.screens.GalleryScreen
import com.brianwelch.smsvault.ui.screens.OnboardingScreen
import com.brianwelch.smsvault.ui.screens.PurgeScreen
import com.brianwelch.smsvault.ui.screens.ThreadScreen
import com.brianwelch.smsvault.ui.screens.VaultListScreen
import com.brianwelch.smsvault.ui.screens.VaultNumbersScreen
import com.brianwelch.smsvault.util.BiometricGate
import com.brianwelch.smsvault.util.VaultLock

object Routes {
    const val ONBOARDING = "onboarding"
    const val NUMBERS = "numbers"
    const val VAULT = "vault"
    const val THREAD = "thread/{threadKey}"
    const val PURGE = "purge"
    const val GALLERY = "gallery"
    const val DIAGNOSTIC = "diagnostic"
    fun thread(threadKey: String) = "thread/$threadKey"
}

@Composable
fun VaultNavHost(activity: FragmentActivity, viewModel: AppViewModel) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.ONBOARDING) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                activity = activity,
                onEnterVault = { navController.navigate(Routes.VAULT) },
                onManageNumbers = { navController.navigate(Routes.NUMBERS) }
            )
        }
        composable(Routes.NUMBERS) {
            VaultNumbersScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
        }
        // Everything below the vault entry is behind the biometric gate.
        composable(Routes.VAULT) {
            BiometricGated(activity) {
                VaultListScreen(
                    viewModel = viewModel,
                    onOpenThread = { navController.navigate(Routes.thread(it)) },
                    onManageNumbers = { navController.navigate(Routes.NUMBERS) },
                    onPurge = { navController.navigate(Routes.PURGE) },
                    onOpenGallery = { navController.navigate(Routes.GALLERY) },
                    onOpenDiagnostic = { navController.navigate(Routes.DIAGNOSTIC) }
                )
            }
        }
        composable(Routes.GALLERY) {
            BiometricGated(activity) {
                GalleryScreen(viewModel = viewModel, onBack = { navController.popBackStack() })
            }
        }
        composable(Routes.DIAGNOSTIC) {
            BiometricGated(activity) {
                DiagnosticScreen(onBack = { navController.popBackStack() })
            }
        }
        composable(Routes.THREAD) { entry ->
            BiometricGated(activity) {
                val key = entry.arguments?.getString("threadKey").orEmpty()
                ThreadScreen(
                    activity = activity,
                    viewModel = viewModel,
                    threadKey = key,
                    onBack = { navController.popBackStack() }
                )
            }
        }
        composable(Routes.PURGE) {
            BiometricGated(activity) {
                PurgeScreen(
                    activity = activity,
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}

/**
 * Wraps sensitive content behind [VaultLock]. When locked (initial state, or after
 * onPause / fold / idle), it hides the content and offers a re-auth button that
 * fires BiometricPrompt. Content is only composed while unlocked, so a locked
 * screen never has vault data in the view tree.
 */
@Composable
fun BiometricGated(activity: FragmentActivity, content: @Composable () -> Unit) {
    val unlocked by VaultLock.unlocked.collectAsState()

    LaunchedEffect(unlocked) {
        if (!unlocked) {
            BiometricGate.prompt(
                activity = activity,
                title = "Unlock vault",
                subtitle = "Authenticate to view archived messages",
                onSuccess = { /* VaultLock flips to unlocked */ },
                onFailure = { /* stays locked; user can retry */ }
            )
        }
    }

    if (unlocked) {
        Box(Modifier.fillMaxSize()) { content() }
    } else {
        LockedPlaceholder(activity)
    }
}

@Composable
private fun LockedPlaceholder(activity: FragmentActivity) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Vault locked", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Authenticate to continue.",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 8.dp)
        )
        Button(
            onClick = {
                BiometricGate.prompt(
                    activity = activity,
                    title = "Unlock vault",
                    subtitle = "Authenticate to view archived messages",
                    onSuccess = {},
                    onFailure = {}
                )
            },
            modifier = Modifier.padding(top = 24.dp)
        ) { Text("Unlock") }
    }
}
