package com.brianwelch.smsvault

import android.app.Application
import com.brianwelch.smsvault.data.VaultRepository
import com.brianwelch.smsvault.mms.ObserverService
import com.brianwelch.smsvault.util.PermissionState

class VaultApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Warm the encrypted DB / keystore on a background-safe path.
        VaultRepository.get(this)
        // Start the observer service only once the runtime SMS/MMS permissions
        // exist; otherwise onboarding will start it after the grant.
        if (PermissionState.smsPermissionsGranted(this)) {
            ObserverService.start(this)
        }
    }
}
