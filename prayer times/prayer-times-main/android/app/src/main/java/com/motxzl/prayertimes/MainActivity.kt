package com.motxzl.prayertimes

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray

class MainActivity : AppCompatActivity() {
    private lateinit var assetLoader: WebViewAssetLoader
    private lateinit var webView: WebView

    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (!granted) {
                Toast.makeText(this, R.string.notification_permission_denied, Toast.LENGTH_LONG).show()
            }
            webView.evaluateJavascript("if (window.updateAlertsBadge) window.updateAlertsBadge();", null)
        }

    private val locationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { permissions ->
            val granted =
                permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

            val origin = pendingGeoOrigin
            if (origin != null) {
                pendingGeoCallback?.invoke(origin, granted, false)
            }

            if (!granted) {
                Toast.makeText(this, R.string.location_permission_denied, Toast.LENGTH_LONG).show()
            }

            clearPendingGeoRequest()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        setContentView(webView)
        createNotificationChannel()
        configureWebView()

        onBackPressedDispatcher.addCallback(this) {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                finish()
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        clearPendingGeoRequest()
        webView.apply {
            stopLoading()
            webChromeClient = null
            webViewClient = null
            removeJavascriptInterface("AndroidApp")
            destroy()
        }
        super.onDestroy()
    }

    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView.addJavascriptInterface(AndroidAppBridge(), "AndroidApp")

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            geolocationEnabled = true
            loadsImagesAutomatically = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "$userAgentString PrayerTimesAndroidApp/1.0"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ) = assetLoader.shouldInterceptRequest(request.url)
                ?: super.shouldInterceptRequest(view, request)

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                if (!request.isForMainFrame) {
                    return false
                }

                val url = request.url
                val isAppAssetUrl = url.scheme == "https" && url.host == APP_ASSET_HOST
                if (isAppAssetUrl) {
                    return false
                }

                return openExternal(url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (origin.isNullOrBlank() || callback == null) {
                    return
                }

                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }

                pendingGeoOrigin = origin
                pendingGeoCallback = callback
                locationPermissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
            }
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fineGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        return fineGranted || coarseGranted
    }

    private fun clearPendingGeoRequest() {
        pendingGeoOrigin = null
        pendingGeoCallback = null
    }

    private fun openExternal(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.external_browser_missing, Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun hasNotificationPermission(): Boolean {
        val runtimePermissionGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

        return runtimePermissionGranted && NotificationManagerCompat.from(this).areNotificationsEnabled()
    }

    private fun requestNotificationPermission(): Boolean {
        if (hasNotificationPermission()) return true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            runOnUiThread {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
            return true
        }

        return false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            PrayerReminderReceiver.CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.notification_channel_description)
        }

        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun schedulePrayerReminders(remindersJson: String) {
        cancelPrayerReminders()

        val reminders = runCatching { JSONArray(remindersJson) }.getOrNull() ?: return
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager

        for (index in 0 until reminders.length()) {
            val reminder = reminders.optJSONObject(index) ?: continue
            val triggerAt = reminder.optLong("triggerAt", 0L)
            if (triggerAt <= System.currentTimeMillis()) continue

            val intent = Intent(this, PrayerReminderReceiver::class.java).apply {
                putExtra(PrayerReminderReceiver.EXTRA_PRAYER_NAME, reminder.optString("name"))
                putExtra(PrayerReminderReceiver.EXTRA_PRAYER_TIME, reminder.optString("time"))
                putExtra(PrayerReminderReceiver.EXTRA_OFFSET, reminder.optInt("offset", 10))
                putExtra(PrayerReminderReceiver.EXTRA_SOUND, reminder.optBoolean("sound", true))
            }

            val pendingIntent = PendingIntent.getBroadcast(
                this,
                REMINDER_REQUEST_CODE_BASE + index,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
        }
    }

    private fun cancelPrayerReminders() {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        for (index in 0 until MAX_REMINDER_ALARMS) {
            val pendingIntent = PendingIntent.getBroadcast(
                this,
                REMINDER_REQUEST_CODE_BASE + index,
                Intent(this, PrayerReminderReceiver::class.java),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            ) ?: continue
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    private fun showTestNotification() {
        val intent = Intent(this, PrayerReminderReceiver::class.java).apply {
            putExtra(PrayerReminderReceiver.EXTRA_TITLE, getString(R.string.test_notification_title))
            putExtra(PrayerReminderReceiver.EXTRA_BODY, getString(R.string.test_notification_body))
            putExtra(PrayerReminderReceiver.EXTRA_SOUND, true)
        }
        sendBroadcast(intent)
    }

    private inner class AndroidAppBridge {
        @JavascriptInterface
        fun isAndroidApp(): Boolean = true

        @JavascriptInterface
        fun areNotificationsAllowed(): Boolean = hasNotificationPermission()

        @JavascriptInterface
        fun requestNotifications(): Boolean = requestNotificationPermission()

        @JavascriptInterface
        fun schedulePrayerReminders(remindersJson: String) {
            this@MainActivity.schedulePrayerReminders(remindersJson)
        }

        @JavascriptInterface
        fun cancelPrayerReminders() {
            this@MainActivity.cancelPrayerReminders()
        }

        @JavascriptInterface
        fun showTestNotification() {
            this@MainActivity.showTestNotification()
        }
    }

    companion object {
        private const val APP_ASSET_HOST = "appassets.androidplatform.net"
        private const val APP_URL = "https://$APP_ASSET_HOST/assets/index.html"
        private const val REMINDER_REQUEST_CODE_BASE = 7100
        private const val MAX_REMINDER_ALARMS = 8
    }
}
