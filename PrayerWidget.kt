package com.motxzl.prayertimes

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class PrayerWidget : AppWidgetProvider() {

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
        // Schedule periodic updates if needed
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_prayer)

        // TODO: Fetch real prayer times from SharedPrefs or calc
        // Demo data
        views.setTextViewText(R.id.current_prayer, "Current: Fajr")
        views.setTextViewText(R.id.next_prayer_time, "Next: Dhuhr at 12:30")
        views.setTextViewText(R.id.last_update, context.getString(R.string.last_update, "today"))

        val intent = Intent(context, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_layout, pendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    companion object {
        fun updateWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, PrayerWidget::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }
}

