package com.motxzl.prayertimes

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

class PrayerReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!canPostNotifications(context)) return

        val prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME).orEmpty().ifBlank { "Prayer" }
        val prayerTime = intent.getStringExtra(EXTRA_PRAYER_TIME).orEmpty()
        val offset = intent.getIntExtra(EXTRA_OFFSET, 10)
        val sound = intent.getBooleanExtra(EXTRA_SOUND, true)
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Prayer Reminder: $prayerName"

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val body = intent.getStringExtra(EXTRA_BODY) ?: if (prayerTime.isBlank()) {
            "$offset minutes until $prayerName prayer."
        } else {
            "$offset minutes until $prayerName prayer ($prayerTime)."
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.prayer_logo)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(openAppPendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSilent(!sound)
            .build()

        NotificationManagerCompat.from(context).notify(prayerName.hashCode(), notification)
    }

    private fun canPostNotifications(context: Context): Boolean {
        val runtimePermissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

        return runtimePermissionGranted && NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    companion object {
        const val CHANNEL_ID = "prayer_reminders"
        const val EXTRA_PRAYER_NAME = "prayer_name"
        const val EXTRA_PRAYER_TIME = "prayer_time"
        const val EXTRA_OFFSET = "offset"
        const val EXTRA_SOUND = "sound"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
    }
}
