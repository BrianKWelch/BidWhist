package com.brianwelch.smsvault.role

import android.app.Activity
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.IBinder

/**
 * Section 7: the four standard SMS-handler components.
 *
 * Android will not OFFER the SMS role (RoleManager.ROLE_SMS) to an app that does
 * not declare all four. They exist only to satisfy that requirement so the purge
 * sweep can temporarily hold the role to delete provider rows. Every one is a
 * no-op: this app never delivers, forwards, composes, or sends a message.
 *
 * While the app transiently holds the role, real SMS_DELIVER / WAP_PUSH_DELIVER
 * broadcasts could arrive here. Doing nothing means those messages are not
 * written to the provider by us — but the sweep is a short, user-initiated
 * window, and the app hands the role straight back (section 7 step 6). The
 * real messaging app resumes delivery once the role is returned.
 */

/** 1) SMS_DELIVER receiver (default-app only). Stub: drops the broadcast. */
class SmsDeliverReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Intentionally empty. We do not persist or forward delivered SMS.
    }
}

/** 2) WAP_PUSH_DELIVER receiver for MMS. Stub: drops the broadcast. */
class MmsWapPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Intentionally empty. MMS capture happens via the ContentObserver path.
    }
}

/** 3) ACTION_SENDTO compose activity. Stub: closes immediately, sends nothing. */
class ComposeSmsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // We are not a messaging client. Immediately finish.
        finish()
    }
}

/** 4) Headless RESPOND_VIA_MESSAGE service. Stub: binds to nothing, sends nothing. */
class HeadlessSmsSendService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        stopSelf()
        return START_NOT_STICKY
    }
}
