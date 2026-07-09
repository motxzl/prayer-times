package com.motxzl.prayertimes

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import android.widget.RemoteViews
import java.util.Calendar

/**
 * AppWidgetProvider for displaying prayer times on home screen.
 * Handles widget updates and user interactions.
 */
class PrayerWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_REFRESH_WIDGET) {
            updateAllWidgets(context)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        // Widget added to home screen
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // Last widget removed
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.prayer_widget_layout)
        val schedule = PrayerScheduleManager.getPrayerTimes(context)

        // Update all prayer times
        views.setTextViewText(R.id.prayer_fajr_time, schedule.fajr)
        views.setTextViewText(R.id.prayer_dhuhr_time, schedule.dhuhr)
        views.setTextViewText(R.id.prayer_asr_time, schedule.asr)
        views.setTextViewText(R.id.prayer_maghrib_time, schedule.maghrib)
        views.setTextViewText(R.id.prayer_isha_time, schedule.isha)

        // Highlight current prayer
        val currentPrayer = schedule.getCurrentPrayer()
        highlightCurrentPrayer(views, currentPrayer)

        // Update last refresh time
        val formatter = DateFormat.getTimeFormat(context)
        val currentTime = formatter.format(Calendar.getInstance().time)
        views.setTextViewText(R.id.widget_last_update, "Updated: $currentTime")

        // Set click listeners
        setupClickListeners(context, views)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun setupClickListeners(context: Context, views: RemoteViews) {
        // Open main app
        val openAppIntent = Intent(context, MainActivity::class.java)
        val openAppPendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Refresh widget
        val refreshIntent = Intent(context, PrayerWidgetProvider::class.java).apply {
            action = ACTION_REFRESH_WIDGET
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context,
            1,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        views.setOnClickPendingIntent(R.id.prayer_widget_container, openAppPendingIntent)
        views.setOnClickPendingIntent(R.id.widget_refresh_btn, refreshPendingIntent)
    }

    private fun highlightCurrentPrayer(views: RemoteViews, currentPrayer: String) {
        // Reset all prayer items background
        views.setInt(R.id.prayer_fajr_item, "setBackgroundColor", 0)
        views.setInt(R.id.prayer_dhuhr_item, "setBackgroundColor", 0)
        views.setInt(R.id.prayer_asr_item, "setBackgroundColor", 0)
        views.setInt(R.id.prayer_maghrib_item, "setBackgroundColor", 0)
        views.setInt(R.id.prayer_isha_item, "setBackgroundColor", 0)

        // Highlight current prayer
        val highlightColor = android.graphics.Color.parseColor("#1A8E6C")
        when (currentPrayer) {
            "Fajr" -> views.setInt(R.id.prayer_fajr_item, "setBackgroundColor", highlightColor)
            "Dhuhr" -> views.setInt(R.id.prayer_dhuhr_item, "setBackgroundColor", highlightColor)
            "Asr" -> views.setInt(R.id.prayer_asr_item, "setBackgroundColor", highlightColor)
            "Maghrib" -> views.setInt(R.id.prayer_maghrib_item, "setBackgroundColor", highlightColor)
            "Isha" -> views.setInt(R.id.prayer_isha_item, "setBackgroundColor", highlightColor)
        }
    }

    companion object {
        private const val ACTION_REFRESH_WIDGET = "com.motxzl.prayertimes.action.REFRESH_WIDGET"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, PrayerWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds.isNotEmpty()) {
                PrayerWidgetProvider().onUpdate(context, appWidgetManager, appWidgetIds)
            }
        }
    }
}

/**
 * Data class representing prayer times schedule
 */
data class PrayerTimesSchedule(
    val fajr: String,
    val dhuhr: String,
    val asr: String,
    val maghrib: String,
    val isha: String
) {
    fun getCurrentPrayer(): String {
        // Simple logic - in production, parse times and compare with current time
        return "Fajr" // Placeholder
    }
}

/**
 * Manager for prayer times logic
 */
object PrayerScheduleManager {
    fun getPrayerTimes(context: Context): PrayerTimesSchedule {
        // TODO: Replace with actual prayer times from your API/database
        // This is a placeholder implementation
        return PrayerTimesSchedule(
            fajr = "04:35",
            dhuhr = "11:56",
            asr = "15:29",
            maghrib = "18:18",
            isha = "19:38"
        )
    }
}
