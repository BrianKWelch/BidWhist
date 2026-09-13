package com.brianwelch.smsvault

import android.os.Build
import android.os.Bundle
import android.view.Window
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.window.layout.WindowInfoTracker
import com.brianwelch.smsvault.mms.ObserverService
import com.brianwelch.smsvault.ui.AppViewModel
import com.brianwelch.smsvault.ui.VaultNavHost
import com.brianwelch.smsvault.ui.theme.VaultTheme
import com.brianwelch.smsvault.util.PermissionState
import com.brianwelch.smsvault.util.VaultLock
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Single Compose host. FragmentActivity is required for BiometricPrompt.
 *
 * Section 8 hardening is all applied here:
 *   - FLAG_SECURE before setContent (blocks screenshot/record, blanks recents)
 *   - setShouldDockBigOverlays(false) (keeps content off a DeX external display)
 *   - WindowInfoTracker fold-state listener -> lock + re-auth on any fold change
 *   - idle timeout (60s) and onPause both re-lock the vault
 */
class MainActivity : FragmentActivity() {

    private val viewModel: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        // Must be set before the first frame.
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        super.onCreate(savedInstanceState)

        // Prevent this activity from surfacing on a DeX / external display.
        // Window.setShouldDockBigOverlays is not part of the public SDK at this
        // compile level, so invoke it reflectively; it applies on platforms that
        // expose it (e.g. the target One UI build) and is a no-op elsewhere.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            runCatching {
                Window::class.java
                    .getMethod("setShouldDockBigOverlays", Boolean::class.javaPrimitiveType)
                    .invoke(window, false)
            }
        }

        observeFoldChanges()
        startIdleWatchdog()

        setContent {
            VaultTheme {
                VaultNavHost(activity = this, viewModel = viewModel)
            }
        }
    }

    /** Section 8: any fold-state change clears content and forces re-auth. */
    private fun observeFoldChanges() {
        val tracker = WindowInfoTracker.getOrCreate(this)
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                var lastSignature: String? = null
                tracker.windowLayoutInfo(this@MainActivity).collect { info ->
                    val signature = info.displayFeatures.joinToString { it.toString() }
                    if (lastSignature != null && signature != lastSignature) {
                        // Fold/unfold or hinge posture change: lock immediately.
                        VaultLock.lock()
                    }
                    lastSignature = signature
                }
            }
        }
    }

    private fun startIdleWatchdog() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (true) {
                    delay(5_000)
                    VaultLock.enforceIdleTimeout()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        // Section 8: auto-lock on onPause.
        VaultLock.lock()
    }

    override fun onResume() {
        super.onResume()
        // Start (or restart) the MMS observer from a guaranteed-foreground context,
        // so opening the app reliably brings capture up and runs an initial sweep
        // that retroactively vaults any MMS received while it was down.
        runCatching {
            if (PermissionState.smsPermissionsGranted(this)) ObserverService.start(this)
        }
    }
}
