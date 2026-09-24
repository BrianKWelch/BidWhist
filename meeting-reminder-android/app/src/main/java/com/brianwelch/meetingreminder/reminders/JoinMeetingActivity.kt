package com.brianwelch.meetingreminder.reminders

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat

/**
 * Invisible activity behind the notification's JOIN MEETING button. Dismisses
 * the notification, then opens the link; Android routes teams.microsoft.com
 * links to the Teams app and zoom.us / zoomgov.com links to Zoom when those
 * apps are installed, otherwise to the browser.
 */
class JoinMeetingActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra(EXTRA_URL)
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)
        if (notificationId >= 0) NotificationManagerCompat.from(this).cancel(notificationId)

        if (url != null) openMeetingLink(this, url)
        finish()
    }

    companion object {
        private const val EXTRA_URL = "url"
        private const val EXTRA_NOTIFICATION_ID = "notificationId"

        fun intent(context: Context, url: String, notificationId: Int): Intent =
            Intent(context, JoinMeetingActivity::class.java)
                .setData(Uri.parse("meetingreminder://join/$notificationId"))
                .putExtra(EXTRA_URL, url)
                .putExtra(EXTRA_NOTIFICATION_ID, notificationId)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)

        /** Shared by the notification and the in-app Join button. */
        fun openMeetingLink(context: Context, url: String) {
            val view = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                .addCategory(Intent.CATEGORY_BROWSABLE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                context.startActivity(view)
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(context, "No app can open this meeting link", Toast.LENGTH_LONG).show()
            }
        }
    }
}
