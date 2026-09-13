package com.brianwelch.smsvault.util

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Process-wide lock state for the vault UI.
 *
 * Locked by default. Unlocked only by a successful BiometricPrompt. Re-locked on:
 *   - onPause of any vault activity (section 8)
 *   - 60s of inactivity (section 8)
 *   - any fold-state change (section 8)
 *
 * The storage keys are NOT gated on this — the observer must keep writing while
 * locked. This only gates what the UI is allowed to render.
 */
object VaultLock {

    private const val IDLE_TIMEOUT_MS = 60_000L

    private val _unlocked = MutableStateFlow(false)
    val unlocked: StateFlow<Boolean> = _unlocked

    @Volatile private var lastInteractionAt: Long = 0

    fun onUnlocked() {
        _unlocked.value = true
        lastInteractionAt = System.currentTimeMillis()
    }

    fun lock() {
        _unlocked.value = false
    }

    fun noteInteraction() {
        lastInteractionAt = System.currentTimeMillis()
    }

    /** Called from a periodic check; locks if idle too long. */
    fun enforceIdleTimeout() {
        if (_unlocked.value && System.currentTimeMillis() - lastInteractionAt > IDLE_TIMEOUT_MS) {
            lock()
        }
    }
}
