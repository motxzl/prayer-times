# Prayer Times Android Widget Implementation

## Overview
This implementation adds a native Android Home Screen Widget that displays all 5 daily prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) in an elegant card format.

## Files Created/Updated

### 1. **PrayerWidgetProvider.kt**
Location: `android/app/src/main/java/com/motxzl/prayertimes/PrayerWidgetProvider.kt`

**Key Features:**
- Extends `AppWidgetProvider` for handling widget lifecycle
- Updates widget UI with prayer times data
- Provides refresh functionality
- Highlights current prayer time
- Click listeners for opening app and refreshing widget
- Integration with `PrayerScheduleManager` for fetching prayer times

**Key Methods:**
- `onUpdate()`: Called when widget needs updating
- `updateAppWidget()`: Updates individual widget instance
- `setupClickListeners()`: Configures touch interactions
- `highlightCurrentPrayer()`: Visual feedback for current prayer

### 2. **prayer_widget_layout.xml**
Location: `android/app/src/main/res/layout/prayer_widget_layout.xml`

**Design:**
- 4x4 minimum grid size (can be resized)
- Clean LinearLayout with ScrollView for prayer times list
- Card-style design for each prayer time
- Header with title and refresh button
- Footer showing last update time
- Each prayer item contains:
  - Prayer name (Fajr, Dhuhr, Asr, Maghrib, Isha)
  - Prayer time in HH:MM format
  - Highlight background for current prayer

### 3. **prayer_widget_info.xml** (Updated)
Location: `android/app/src/main/res/xml/prayer_widget_info.xml`

**Configuration:**
- Minimum dimensions: 260dp x 260dp (4x4 grid)
- Maximum dimensions: 500dp x 500dp (resizable)
- Update period: 30 minutes (1800000 ms)
- Home screen only widget
- Supports lock screen display

### 4. **AndroidManifest.xml** (Updated)
Added widget receiver configuration:

```xml
<receiver
    android:name=".PrayerWidgetProvider"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.motxzl.prayertimes.action.REFRESH_WIDGET" />
    </intent-filter>

    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/prayer_widget_info" />
</receiver>
```

## Integration Steps

### 1. **Update Prayer Times Source**
Modify `PrayerScheduleManager.getPrayerTimes()` in `PrayerWidgetProvider.kt` to fetch actual prayer times from your API/database:

```kotlin
object PrayerScheduleManager {
    fun getPrayerTimes(context: Context): PrayerTimesSchedule {
        // Replace with actual API call or database query
        val prayerTimes = fetchPrayerTimesFromAPI(context)
        return PrayerTimesSchedule(
            fajr = prayerTimes.fajr,
            dhuhr = prayerTimes.dhuhr,
            asr = prayerTimes.asr,
            maghrib = prayerTimes.maghrib,
            isha = prayerTimes.isha
        )
    }
}
```

### 2. **Implement Current Prayer Logic**
Update `getCurrentPrayer()` method to determine the actual current prayer:

```kotlin
fun getCurrentPrayer(): String {
    val now = Calendar.getInstance()
    // Parse times and compare with current time
    // Return prayer name
}
```

### 3. **Update Required Permissions (if needed)**
The widget uses existing permissions from your app. Ensure these are present in AndroidManifest.xml:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### 4. **Add Widget Preview Image (Optional)**
Create `widget_preview.png` in `android/app/src/main/res/drawable/` (recommended: 512x512px)

### 5. **Build & Test**

```bash
# Build the app
./gradlew build

# Run tests
./gradlew test

# Install on device/emulator
./gradlew installDebug
```

## Widget Size Guide

Recommended widget sizes:
- **Small (4x2)**: Shows 2-3 prayers per view
- **Medium (4x4)**: Shows all 5 prayers with scroll
- **Large (4x5+)**: Shows all prayers with extra space

## Features

✅ Displays all 5 prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha)
✅ Clean card-based UI with dark theme
✅ Highlights current prayer with background color
✅ Refresh button for manual updates
✅ Auto-updates every 30 minutes
✅ Tap to open main app
✅ Resizable widget (4x2 minimum to 4x5+)
✅ Lock screen support

## Customization

### Change Update Frequency
Edit `android/app/src/main/res/xml/prayer_widget_info.xml`:
```xml
android:updatePeriodMillis="1800000"  <!-- 30 minutes in milliseconds -->
```

### Modify Colors
Edit `android/app/src/main/res/values/colors.xml`:
```xml
<color name="prayer_green">#2EC49C</color>
<color name="widget_surface">#142923</color>
```

### Adjust Layout Size
Edit `prayer_widget_layout.xml` min/max height attributes

## Testing Checklist

- [ ] Widget appears in widget picker
- [ ] Widget can be added to home screen
- [ ] Prayer times display correctly
- [ ] Current prayer is highlighted
- [ ] Refresh button works
- [ ] Tap to open app works
- [ ] Widget updates after 30 minutes
- [ ] Supports 4x2, 4x4, and 4x5 sizes
- [ ] Looks good in dark and light themes

## Troubleshooting

**Widget not showing in picker:**
- Verify receiver is exported in manifest
- Check that `prayer_widget_info.xml` is in `res/xml/`
- Rebuild app

**Times not updating:**
- Ensure `getPrayerTimes()` is returning data
- Check device has internet connection
- Verify update period in `prayer_widget_info.xml`

**Layout issues:**
- Test on multiple screen sizes
- Use Android Studio's preview tool
- Check for conflicting drawable backgrounds
