/**
 * Islam Times - Islamic Prayer Times App
 * Full rewrite: reliable loading, live countdown, working Qibla compass,
 * notifications, PWA install, light/dark mode, share, settings.
 */

// ─── Arabic prayer names lookup ───────────────────────────────────────
const ARABIC = {
    Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر',
    Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء'
};

// ─── Main 5 prayers used for next-prayer logic ────────────────────────
const MAIN_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// ─── Country → cities mapping (kept compact; add more as needed) ──────
const CITIES = {
    'Egypt': ['Cairo','Alexandria','Giza','Port Said','Suez','Luxor','Aswan','Asyut','Ismailia','Zagazig','Tanta','Mansoura','Hurghada','Minya','Damietta'],
    'Saudi Arabia': ['Mecca','Medina','Riyadh','Jeddah','Dammam','Taif','Khobar','Tabuk','Abha','Najran'],
    'UAE': ['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah'],
    'Turkey': ['Istanbul','Ankara','Izmir','Bursa','Adana','Gaziantep','Konya','Antalya'],
    'Pakistan': ['Karachi','Lahore','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta'],
    'Bangladesh': ['Dhaka','Chittagong','Khulna','Rajshahi','Sylhet'],
    'Indonesia': ['Jakarta','Bandung','Surabaya','Medan','Semarang','Makassar'],
    'Malaysia': ['Kuala Lumpur','George Town','Johor Bahru','Ipoh','Shah Alam'],
    'India': ['Mumbai','Delhi','Bangalore','Hyderabad','Ahmedabad','Chennai','Kolkata','Lucknow','Patna','Jaipur'],
    'United States': ['New York','Los Angeles','Chicago','Houston','Detroit','Chicago','Dearborn','Jersey City'],
    'United Kingdom': ['London','Birmingham','Manchester','Bradford','Leicester'],
    'Canada': ['Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa'],
    'Australia': ['Sydney','Melbourne','Brisbane','Perth','Adelaide'],
    'Germany': ['Berlin','Hamburg','Munich','Cologne','Frankfurt'],
    'France': ['Paris','Marseille','Lyon','Lille','Toulouse'],
    'Morocco': ['Casablanca','Rabat','Fès','Marrakech','Meknès','Agadir'],
    'Tunisia': ['Tunis','Sfax','Sousse','Kairouan'],
    'Algeria': ['Algiers','Oran','Constantine','Annaba'],
    'Libya': ['Tripoli','Benghazi','Misrata'],
    'Jordan': ['Amman','Zarqa','Irbid'],
    'Lebanon': ['Beirut','Tripoli','Sidon'],
    'Syria': ['Damascus','Aleppo','Homs'],
    'Iraq': ['Baghdad','Basra','Mosul','Erbil','Najaf','Karbala'],
    'Iran': ['Tehran','Mashhad','Isfahan','Tabriz','Shiraz'],
    'Kuwait': ['Kuwait City'],
    'Qatar': ['Doha'],
    'Bahrain': ['Manama'],
    'Oman': ['Muscat','Salalah'],
    'Yemen': ['Sana\'a','Aden','Taiz'],
    'Sudan': ['Khartoum','Omdurman'],
    'Somalia': ['Mogadishu'],
    'Palestine': ['Gaza','Hebron','Nablus','Ramallah'],
    'Afghanistan': ['Kabul','Kandahar','Herat','Mazar-i-Sharif'],
    'Kazakhstan': ['Almaty','Nur-Sultan'],
    'Uzbekistan': ['Tashkent','Samarkand','Bukhara'],
    'Russia': ['Moscow','Saint Petersburg','Kazan','Ufa'],
    'China': ['Urumqi','Beijing','Shanghai'],
    'Nigeria': ['Lagos','Abuja','Kano','Ibadan'],
    'South Africa': ['Johannesburg','Cape Town','Durban'],
    'Kenya': ['Nairobi','Mombasa'],
    'Netherlands': ['Amsterdam','Rotterdam','The Hague'],
    'Belgium': ['Brussels','Antwerp'],
    'Sweden': ['Stockholm','Gothenburg','Malmö'],
    'Norway': ['Oslo'],
    'Denmark': ['Copenhagen'],
    'Switzerland': ['Zurich','Geneva','Basel'],
    'Austria': ['Vienna'],
    'Italy': ['Rome','Milan'],
    'Spain': ['Madrid','Barcelona'],
    'Greece': ['Athens','Thessaloniki'],
    'Bosnia and Herzegovina': ['Sarajevo','Banja Luka'],
    'Albania': ['Tirana'],
    'Kosovo': ['Pristina'],
    'North Macedonia': ['Skopje'],
    'Singapore': ['Singapore'],
    'Philippines': ['Cotabato','Marawi','Manila'],
    'Thailand': ['Bangkok','Pattani'],
    'Japan': ['Tokyo','Osaka'],
    'New Zealand': ['Auckland','Wellington'],
    'Brazil': ['São Paulo','Rio de Janeiro'],
    'Argentina': ['Buenos Aires'],
};

// ─── App class ────────────────────────────────────────────────────────
class IslamTimes {
    constructor() {
        // Settings with localStorage persistence
        this.s = {
            timeFormat: localStorage.getItem('it_fmt') || '12',
            method: localStorage.getItem('it_method') || '5',
            theme: localStorage.getItem('it_theme') || 'dark',
            notifs: localStorage.getItem('it_notifs') === 'true'
        };

        // State
        this.loc = null;         // { lat, lng, city, country }
        this.times = null;       // raw prayer times from API
        this.next = null;        // { name, time, diff (ms) }
        this.qibla = 0;          // bearing to Kaaba in degrees
        this.heading = 0;        // device compass heading
        this._cdInterval = null;
        this._clockInterval = null;
        this._pwaPrompt = null;
        this._notifTimers = [];
        this._orientationListening = false;
        this._orientationPermissionRequested = false;
        this._orientationHandler = null;
        this._smoothedHeading = null;
        this._eventsInterval = null;

        this.init();
    }

    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────
    init() {
        this._populateCountries();
        this._applySettings();
        this._bindEvents();
        this._startClock();
        this._startEventCountdowns();

        // Default: Cairo — loads prayer times immediately without waiting for GPS
        this._setLocation({ lat: 30.0444, lng: 31.2357, city: 'Cairo', country: 'Egypt' });

        // Then attempt GPS in background
        this._detectGPS();
    }

    // ─────────────────────────────────────────────
    // LOCATION
    // ─────────────────────────────────────────────
    _setLocation(loc) {
        this.loc = loc;
        this._setEl('loc-label', `${loc.city}, ${loc.country}`);
        this._setEl('qibla-from', `${loc.city}, ${loc.country}`);
        this._calcQibla();
        this._fetchTimes();
    }

    async _detectGPS() {
        if (!navigator.geolocation) return;
        try {
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 300000 })
            );
            const { latitude: lat, longitude: lng } = pos.coords;
            const { city, country } = await this._reverseGeocode(lat, lng);
            this._setLocation({ lat, lng, city, country });
        } catch (_) { /* keep default Cairo */ }
    }

    async _reverseGeocode(lat, lng) {
        try {
            const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            const d = await r.json();
            return { city: d.city || d.locality || 'Unknown', country: d.countryName || 'Unknown' };
        } catch (_) {
            return { city: `${lat.toFixed(3)}°`, country: `${lng.toFixed(3)}°` };
        }
    }

    async _searchCity() {
        const city = this._getEl('city-inp')?.value.trim();
        const country = this._getEl('country-sel')?.value;
        if (!country) { this._locErr('Please select a country first.'); return; }
        if (!city) { this._locErr('Please enter a city name.'); return; }

        const btn = this._getEl('search-btn');
        if (!btn) return;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Searching...';
        btn.disabled = true;

        try {
            // Try geocoding for accurate coordinates
            const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&language=en&limit=1`);
            const d = await r.json();
            if (d.results?.length) {
                const g = d.results[0];
                this._setLocation({ lat: g.latitude, lng: g.longitude, city, country });
            } else {
                // Fall back to city-based API endpoint
                this.loc = { city, country, method: 'city' };
                this._setEl('loc-label', `${city}, ${country}`);
                this._setEl('qibla-from', `${city}, ${country}`);
                await this._fetchTimes();
            }
            this._closeLocPanel();
        } catch (e) {
            this._locErr('City not found. Please check the spelling.');
        } finally {
            btn.innerHTML = '<i class="fas fa-magnifying-glass"></i>Search';
            btn.disabled = false;
        }
    }

    // ─────────────────────────────────────────────
    // PRAYER TIMES API
    // ─────────────────────────────────────────────
    async _fetchTimes() {
        if (!this.loc) return;
        try {
            const base = 'https://api.aladhan.com/v1';
            const ts = Math.floor(Date.now() / 1000);
            let url;

            if (this.loc.lat !== undefined) {
                url = `${base}/timings/${ts}?latitude=${this.loc.lat}&longitude=${this.loc.lng}&method=${this.s.method}`;
            } else {
                url = `${base}/timingsByCity?city=${encodeURIComponent(this.loc.city)}&country=${encodeURIComponent(this.loc.country)}&method=${this.s.method}`;
            }

            const r = await fetch(url);
            const d = await r.json();

            if (d.code === 200) {
                this.times = d.data.timings;
                this._updateDates(d.data.date);
                this._renderTimes();
                this._calcNext();
                this._startCountdown();
                if (this.s.notifs) this._scheduleNotifications();
            } else {
                throw new Error(d.status || 'API error');
            }
        } catch (e) {
            this._showErr('Failed to load prayer times. Check your connection and try again.');
        }
    }

    // ─────────────────────────────────────────────
    // RENDER DATES
    // ─────────────────────────────────────────────
    _updateDates(dateData) {
        const g = dateData.gregorian;
        const h = dateData.hijri;
        this._setEl('gregorian-date', `${g.weekday.en}, ${g.day} ${g.month.en} ${g.year}`);
        this._setEl('hijri-date', `${h.day} ${h.month.en} ${h.year} هـ`);
    }

    // ─────────────────────────────────────────────
    // RENDER PRAYER TIMES
    // ─────────────────────────────────────────────
    _renderTimes() {
        if (!this.times) return;
        const map = {
            Fajr: 'fajr-time', Sunrise: 'sunrise-time', Dhuhr: 'dhuhr-time',
            Asr: 'asr-time', Maghrib: 'maghrib-time', Isha: 'isha-time',
            Imsak: 'imsak-time', Midnight: 'midnight-time',
            Firstthird: 'firstthird-time', Lastthird: 'lastthird-time'
        };
        for (const [prayer, elId] of Object.entries(map)) {
            const raw = this.times[prayer] || this.times[prayer.charAt(0).toUpperCase() + prayer.slice(1)];
            if (raw) this._setEl(elId, this._fmt(raw));
        }
        this._highlightCurrent();
    }

    // ─────────────────────────────────────────────
    // FORMAT TIME  "14:30" → "2:30 PM" or "14:30"
    // ─────────────────────────────────────────────
    _fmt(t) {
        if (!t) return '--:--';
        // Strip seconds if present e.g. "05:12 (CEST)"
        const clean = t.replace(/\s+\(.*\)/, '').replace(/:\d\d$/, (m) => m.length > 3 ? '' : m).trim();
        if (this.s.timeFormat === '24') return clean;
        const [hStr, mStr] = clean.split(':');
        const h = parseInt(hStr);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${mStr} ${ampm}`;
    }

    // ─────────────────────────────────────────────
    // NEXT PRAYER CALCULATION
    // ─────────────────────────────────────────────
    _calcNext() {
        if (!this.times) return;
        const now = new Date();
        const nowMs = now.getTime();

        let best = null;
        let bestDiff = Infinity;

        for (const name of MAIN_PRAYERS) {
            const raw = this.times[name];
            if (!raw) continue;
            const [h, m] = raw.split(':').map(Number);
            const pDate = new Date(now);
            pDate.setHours(h, m, 0, 0);
            let diff = pDate - nowMs;
            if (diff <= 0) diff += 86400000; // tomorrow
            if (diff < bestDiff) {
                bestDiff = diff;
                best = { name, time: raw, diff };
            }
        }

        if (best) {
            this.next = best;
            this._setEl('next-name', best.name);
            this._setEl('next-arabic', ARABIC[best.name] || '');
            this._setEl('next-time', this._fmt(best.time));
            this._highlightCurrent();
        }
    }

    // ─────────────────────────────────────────────
    // COUNTDOWN TIMER
    // ─────────────────────────────────────────────
    _startCountdown() {
        if (this._cdInterval) clearInterval(this._cdInterval);
        this._cdInterval = setInterval(() => this._tickCountdown(), 1000);
        this._tickCountdown();
    }

    _tickCountdown() {
        if (!this.next) return;
        const now = new Date();
        const [h, m] = this.next.time.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);
        let diff = target - now;
        if (diff <= 0) {
            diff += 86400000;
            // Recalculate next prayer at boundary
            this._calcNext();
        }

        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const countdown = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        this._setEl('cd-h', String(hrs).padStart(2, '0'));
        this._setEl('cd-m', String(mins).padStart(2, '0'));
        this._setEl('cd-s', String(secs).padStart(2, '0'));
        this._setEl('countdown', countdown);
    }

    // ─────────────────────────────────────────────
    // LIVE CLOCK
    // ─────────────────────────────────────────────
    _startClock() {
        this._updateClock();
        this._clockInterval = setInterval(() => this._updateClock(), 1000);
    }

    _updateClock() {
        const now = new Date();
        let s;
        if (this.s.timeFormat === '12') {
            s = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } else {
            s = now.toTimeString().slice(0, 8);
        }
        this._setEl('current-time', s);
    }

    // ─────────────────────────────────────────────
    // ISLAMIC EVENTS COUNTDOWNS
    // ─────────────────────────────────────────────
    _startEventCountdowns() {
        this._updateEventCountdowns();
        if (this._eventsInterval) clearInterval(this._eventsInterval);
        this._eventsInterval = setInterval(() => this._updateEventCountdowns(), 60 * 60 * 1000);
    }

    _updateEventCountdowns() {
        const events = [
            { key: 'ramadan', month: 9, day: 1, dateEl: 'ramadan-date', countdownEl: 'ramadan-countdown' },
            { key: 'eidFitr', month: 10, day: 1, dateEl: 'eid-fitr-date', countdownEl: 'eid-fitr-countdown' },
            { key: 'eidAdha', month: 12, day: 10, dateEl: 'eid-adha-date', countdownEl: 'eid-adha-countdown' }
        ];

        for (const ev of events) {
            const target = this._findNextIslamicDate(ev.month, ev.day);
            if (!target) {
                this._setEl(ev.dateEl, 'Not available');
                this._setEl(ev.countdownEl, '--');
                continue;
            }

            this._setEl(ev.dateEl, target.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }));
            this._setEl(ev.countdownEl, this._daysUntilLabel(target));
        }
    }

    _daysUntilLabel(targetDate) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const days = Math.ceil((target - start) / 86400000);

        if (days <= 0) return 'Today';
        if (days === 1) return '1 day';
        return `${days} days`;
    }

    _findNextIslamicDate(targetMonth, targetDay) {
        const today = new Date();
        for (let i = 0; i < 900; i++) {
            const probe = new Date(today);
            probe.setDate(today.getDate() + i);
            probe.setHours(12, 0, 0, 0);

            const h = this._getIslamicDateParts(probe);
            if (!h) continue;
            if (h.month === targetMonth && h.day === targetDay) return probe;
        }
        return null;
    }

    _getIslamicDateParts(date) {
        try {
            const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric'
            });
            const parts = fmt.formatToParts(date);
            const day = parseInt(parts.find(p => p.type === 'day')?.value, 10);
            const month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
            const year = parseInt(parts.find(p => p.type === 'year')?.value, 10);
            if ([day, month, year].some(Number.isNaN)) return null;
            return { day, month, year };
        } catch (_) {
            return null;
        }
    }

    // ─────────────────────────────────────────────
    // HIGHLIGHT CURRENT ACTIVE PRAYER CARD
    // ─────────────────────────────────────────────
    _highlightCurrent() {
        document.querySelectorAll('.prayer-card').forEach(c => c.classList.remove('active'));
        if (this.next) {
            const card = document.querySelector(`[data-prayer="${this.next.name}"]`);
            if (card) card.classList.add('active');
        }
    }

    // ─────────────────────────────────────────────
    // QIBLA COMPASS
    // ─────────────────────────────────────────────
    _calcQibla() {
        if (!this.loc || this.loc.lat === undefined) return;

        // Kaaba coordinates
        const kLat = 21.4225, kLng = 39.8262;
        const lat1 = this.loc.lat * Math.PI / 180;
        const lat2 = kLat * Math.PI / 180;
        const dLng = (kLng - this.loc.lng) * Math.PI / 180;

        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;

        this.qibla = bearing;
        this._renderQibla();
        this._setupDeviceOrientation();
    }

    _renderQibla() {
        const b = Math.round(this.qibla);
        this._setEl('qibla-deg', `${b}°`);
        this._setEl('debug-bearing', `${b}°`);

        // Direction name
        const dirs = [
            [337.5, 360, 'North ↑'], [0, 22.5, 'North ↑'],
            [22.5, 67.5, 'Northeast ↗'], [67.5, 112.5, 'East →'],
            [112.5, 157.5, 'Southeast ↘'], [157.5, 202.5, 'South ↓'],
            [202.5, 247.5, 'Southwest ↙'], [247.5, 292.5, 'West ←'],
            [292.5, 337.5, 'Northwest ↖']
        ];
        let dir = 'North';
        for (const [lo, hi, name] of dirs) {
            if (b >= lo && b < hi) { dir = name; break; }
        }
        this._setEl('qibla-dir', dir);

        // Rotate needle (static, no device orientation yet)
        this._rotateNeedle(this.qibla - this.heading);
    }

    _rotateNeedle(angle) {
        const wrap = this._getEl('needle-wrap');
        if (wrap) wrap.style.transform = `rotate(${angle}deg)`;
    }

    _setupDeviceOrientation() {
        if (this._orientationListening || this._orientationPermissionRequested) return;

        // iOS 13+ requires explicit permission
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
            this._orientationPermissionRequested = true;
            document.addEventListener('click', () => {
                DeviceOrientationEvent.requestPermission()
                    .then(s => {
                        this._orientationPermissionRequested = false;
                        if (s === 'granted') this._listenOrientation();
                    })
                    .catch(() => {
                        this._orientationPermissionRequested = false;
                    });
            }, { once: true });
        } else if (window.DeviceOrientationEvent) {
            this._listenOrientation();
        }
    }

    _listenOrientation() {
        if (this._orientationListening) return;

        const handler = (e) => {
            const rawHeading = this._extractHeading(e);
            if (rawHeading === null) return;

            const previous = this._smoothedHeading ?? rawHeading;
            const delta = this._shortestAngleDelta(previous, rawHeading);

            if (Math.abs(delta) < 1.2) return;

            const smoothing = e.absolute ? 0.18 : 0.1;
            this._smoothedHeading = (previous + delta * smoothing + 360) % 360;
            this.heading = this._smoothedHeading;
            this._rotateNeedle(this.qibla - this.heading);
            this._setEl('dbg-heading', `${Math.round(this.heading)}°`);
        };

        this._orientationHandler = handler;
        window.addEventListener('deviceorientationabsolute', handler);
        window.addEventListener('deviceorientation', handler);
        this._orientationListening = true;
    }

    // ─────────────────────────────────────────────
    // NOTIFICATIONS
    // ─────────────────────────────────────────────
    async _requestNotifPermission() {
        if (!('Notification' in window)) {
            this._showErr('Your browser does not support notifications.'); return false;
        }
        if (Notification.permission === 'granted') return true;
        const perm = await Notification.requestPermission();
        return perm === 'granted';
    }

    async _toggleNotifs() {
        if (!this.s.notifs) {
            const ok = await this._requestNotifPermission();
            if (!ok) { this._showErr('Please allow notifications in your browser settings.'); return; }
        }
        this.s.notifs = !this.s.notifs;
        localStorage.setItem('it_notifs', this.s.notifs);
        this._updateNotifToggle();
        if (this.s.notifs && this.times) this._scheduleNotifications();
        else this._clearNotifTimers();
    }

    _updateNotifToggle() {
        const track = document.getElementById('notif-track');
        const lbl = document.getElementById('notif-lbl');
        if (track) {
            track.classList.toggle('on', this.s.notifs);
            track.dataset.on = this.s.notifs ? 'true' : 'false';
        }
        if (lbl) lbl.textContent = this.s.notifs ? 'On' : 'Off';
        if (typeof window.updateAlertsBadge === 'function') window.updateAlertsBadge();
    }

    _scheduleNotifications() {
        this._clearNotifTimers();
        if (!this.times || !this.s.notifs) return;
        const now = new Date();

        for (const name of MAIN_PRAYERS) {
            const raw = this.times[name];
            if (!raw) continue;
            const [h, m] = raw.split(':').map(Number);
            const target = new Date();
            target.setHours(h, m, 0, 0);
            const diff = target - now;
            if (diff > 0 && diff < 86400000) {
                const t = setTimeout(() => {
                    if (Notification.permission === 'granted') {
                        new Notification(`🕌 ${name} — ${ARABIC[name]}`, {
                            body: `It's time for ${name} prayer (${this._fmt(raw)})`,
                            icon: '/icon-192.png',
                            tag: name
                        });
                    }
                }, diff);
                this._notifTimers.push(t);
            }
        }
    }

    _clearNotifTimers() {
        this._notifTimers.forEach(t => clearTimeout(t));
        this._notifTimers = [];
    }

    // ─────────────────────────────────────────────
    // SHARE
    // ─────────────────────────────────────────────
    _share() {
        if (!this.times) { this._showToast('Prayer times not loaded yet.'); return; }

        const loc = this.loc ? `${this.loc.city}, ${this.loc.country}` : 'Cairo, Egypt';
        const lines = MAIN_PRAYERS.map(p => `${p}: ${this._fmt(this.times[p])}`).join('\n');
        const text = `🕌 Prayer Times — ${loc}\n\n${lines}\n\nvia islamtimes.netlify.app`;

        if (navigator.share) {
            navigator.share({ title: 'Prayer Times', text, url: 'https://islamtimes.netlify.app/' }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => this._showToast('Copied to clipboard! ✓'));
        }
    }

    // ─────────────────────────────────────────────
    // THEME
    // ─────────────────────────────────────────────
    _toggleTheme() {
        this.s.theme = this.s.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('it_theme', this.s.theme);
        this._applyTheme();
    }

    _applyTheme() {
        const isLight = this.s.theme === 'light';
        document.documentElement.classList.toggle('dark', !isLight);
        document.documentElement.classList.toggle('light', isLight);
        document.body.classList.toggle('dark', !isLight);
        document.body.classList.toggle('light', isLight);
        document.body.style.colorScheme = isLight ? 'light' : 'dark';

        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
            themeMeta.setAttribute('content', isLight ? '#f0fdf4' : '#059669');
        }

        const track = this._getEl('theme-track');
        const lbl = this._getEl('theme-lbl');
        const icon = this._getEl('theme-icon');
        if (track) track.classList.toggle('on', isLight);
        if (lbl) lbl.textContent = isLight ? 'Light' : 'Dark';
        if (icon) { icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon'; }

        const button = this._getEl('theme-btn');
        if (button) {
            const buttonIcon = button.querySelector('i');
            const buttonText = button.querySelector('span');
            if (buttonIcon) buttonIcon.className = isLight ? 'fas fa-sun mr-3 text-xl' : 'fas fa-moon mr-3 text-xl';
            if (buttonText) buttonText.textContent = isLight ? 'Light Mode - الوضع الفاتح' : 'Dark Mode - الوضع المظلم';
        }
    }

    // ─────────────────────────────────────────────
    // SETTINGS APPLY
    // ─────────────────────────────────────────────
    _applySettings() {
        // Theme
        this._applyTheme();

        // Selects
        const methodSel = this._getEl('method-sel');
        const fmtSel = this._getEl('format-sel');
        if (methodSel) methodSel.value = this.s.method;
        if (fmtSel) fmtSel.value = this.s.timeFormat;

        // Notif toggle
        this._updateNotifToggle();
    }

    // ─────────────────────────────────────────────
    // COUNTRY / CITY DROPDOWNS
    // ─────────────────────────────────────────────
    _populateCountries() {
        const sel = this._getEl('country-sel');
        if (!sel) return;
        if (sel.options.length > 1) return;
        Object.keys(CITIES).sort().forEach(c => {
            const opt = document.createElement('option');
            opt.value = c; opt.textContent = c;
            sel.appendChild(opt);
        });
    }

    _onCountryChange(country) {
        const inp = this._getEl('city-inp');
        const drop = this._getEl('city-drop');
        if (!inp || !drop) return;

        inp.disabled = !country;
        inp.value = '';
        inp.placeholder = country ? `Type or choose a city in ${country}` : 'Select country first';
        drop.innerHTML = '';
        drop.classList.add('hidden');

        if (country && CITIES[country]) {
            this._renderCityDrop(CITIES[country]);
        }
    }

    _renderCityDrop(cities) {
        const drop = this._getEl('city-drop');
        if (!drop) return;
        drop.innerHTML = cities.map(c =>
            `<li data-city="${c}">${c}</li>`
        ).join('');
        drop.classList.remove('hidden');
    }

    _filterCities(q) {
        const country = this._getEl('country-sel')?.value;
        if (!country || !CITIES[country]) return;
        const filtered = CITIES[country].filter(c => c.toLowerCase().includes(q.toLowerCase()));
        if (filtered.length) this._renderCityDrop(filtered);
        else this._getEl('city-drop')?.classList.add('hidden');
    }

    // ─────────────────────────────────────────────
    // PWA INSTALL
    // ─────────────────────────────────────────────
    _showInstallBtn() {
        const btn = this._getEl('install-btn');
        if (btn) btn.classList.add('visible');
    }

    async _installApp() {
        if (!this._pwaPrompt) return;
        this._pwaPrompt.prompt();
        const { outcome } = await this._pwaPrompt.userChoice;
        if (outcome === 'accepted') {
            this._getEl('install-btn')?.classList.remove('visible');
        }
        this._pwaPrompt = null;
    }

    // ─────────────────────────────────────────────
    // BIND ALL EVENTS
    // ─────────────────────────────────────────────
    _bindEvents() {

        // Header buttons
        this._getEl('notif-btn')?.addEventListener('click', () => this._toggleNotifs());
        this._getEl('share-btn')?.addEventListener('click', () => this._share());
        this._getEl('theme-btn')?.addEventListener('click', () => this._toggleTheme());

        // Location panel
        this._getEl('loc-btn')?.addEventListener('click', () => this._toggleLocPanel());
        this._getEl('loc-close')?.addEventListener('click', () => this._closeLocPanel());
        this._getEl('detect-btn')?.addEventListener('click', async () => {
            const btn = this._getEl('detect-btn');
            if (!btn) return;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Detecting...';
            btn.disabled = true;
            await this._detectGPS();
            this._closeLocPanel();
            btn.innerHTML = '<i class="fas fa-crosshairs"></i>Auto-detect';
            btn.disabled = false;
        });
        this._getEl('search-btn')?.addEventListener('click', () => this._searchCity());

        // Country/city selects
        this._getEl('country-sel')?.addEventListener('change', e => this._onCountryChange(e.target.value));
        this._getEl('city-inp')?.addEventListener('input', e => this._filterCities(e.target.value));
        this._getEl('city-inp')?.addEventListener('focus', () => {
            const country = this._getEl('country-sel')?.value;
            if (country && CITIES[country]) this._renderCityDrop(CITIES[country]);
        });
        this._getEl('city-inp')?.addEventListener('blur', () => {
            setTimeout(() => this._getEl('city-drop')?.classList.add('hidden'), 180);
        });
        this._getEl('city-drop')?.addEventListener('click', e => {
            const li = e.target.closest('li');
            if (li?.dataset.city) {
                this._getEl('city-inp').value = li.dataset.city;
                this._getEl('city-drop').classList.add('hidden');
            }
        });
        this._getEl('city-inp')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') this._searchCity();
        });

        // Settings
        this._getEl('method-sel')?.addEventListener('change', e => {
            this.s.method = e.target.value;
            localStorage.setItem('it_method', this.s.method);
            this._fetchTimes();
        });
        this._getEl('format-sel')?.addEventListener('change', e => {
            this.s.timeFormat = e.target.value;
            localStorage.setItem('it_fmt', this.s.timeFormat);
            this._renderTimes();
            this._calcNext();
        });

        // In-settings toggles (duplicate of header for convenience)
        document.getElementById('notif-row')?.addEventListener('click', () => this._toggleNotifs());
        document.getElementById('theme-row')?.addEventListener('click', () => this._toggleTheme());

        // PWA install
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            this._pwaPrompt = e;
            this._showInstallBtn();
        });
        window.addEventListener('appinstalled', () => {
            this._getEl('install-btn')?.classList.remove('visible');
        });
        this._getEl('install-btn')?.addEventListener('click', () => this._installApp());

        // Close location panel when clicking outside
        document.addEventListener('click', e => {
            const panel = this._getEl('loc-panel');
            const btn = this._getEl('loc-btn');
            if (panel && !panel.classList.contains('hidden') &&
                !panel.contains(e.target) && !btn?.contains(e.target)) {
                this._closeLocPanel();
            }
        });
    }

    // ─────────────────────────────────────────────
    // LOCATION PANEL
    // ─────────────────────────────────────────────
    _toggleLocPanel() {
        const p = this._getEl('loc-panel');
        if (p) p.classList.toggle('hidden');
    }

    _closeLocPanel() {
        this._getEl('loc-panel')?.classList.add('hidden');
    }

    _locErr(msg) {
        const el = this._getEl('loc-err');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }

    // ─────────────────────────────────────────────
    // ERROR BANNER
    // ─────────────────────────────────────────────
    _showErr(msg) {
        // Remove existing
        document.querySelectorAll('.err-banner').forEach(e => e.remove());
        const div = document.createElement('div');
        div.className = 'err-banner';
        div.innerHTML = `<i class="fas fa-triangle-exclamation" style="margin-top:2px;flex-shrink:0;"></i><span>${msg}</span><button onclick="this.closest('.err-banner').remove()" style="margin-left:auto;background:none;border:none;color:#fff;cursor:pointer;flex-shrink:0;">✕</button>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 7000);
    }

    // ─────────────────────────────────────────────
    // TOAST
    // ─────────────────────────────────────────────
    _showToast(msg) {
        document.querySelectorAll('.toast').forEach(t => t.remove());
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2800);
    }

    // ─────────────────────────────────────────────
    // UTIL
    // ─────────────────────────────────────────────
    _setEl(id, val) {
        const el = this._getEl(id);
        if (el) el.textContent = val;
    }

    _getEl(id) {
        const aliases = {
            'loc-label': ['current-location'],
            'qibla-from': ['qibla-location'],
            'qibla-deg': ['qibla-angle'],
            'qibla-dir': ['qibla-direction'],
            'needle-wrap': ['qibla-needle'],
            'dbg-heading': ['debug-heading'],
            'install-btn': ['install-button'],
            'theme-btn': ['theme-toggle'],
            'method-sel': ['calculation-method'],
            'format-sel': ['time-format'],
            'country-sel': ['country-input'],
            'city-inp': ['city-input'],
            'city-drop': ['city-suggestion-list'],
            'search-btn': ['manual-location'],
            'detect-btn': ['detect-location'],
            'loc-btn': ['location-toggle'],
            'loc-panel': ['location-settings'],
            'next-name': ['next-prayer-name'],
            'next-time': ['next-prayer-time']
        };

        for (const candidate of [id, ...(aliases[id] || [])]) {
            const el = document.getElementById(candidate);
            if (el) return el;
        }
        return null;
    }

    _extractHeading(e) {
        if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
            return (e.webkitCompassHeading + 360) % 360;
        }

        if (typeof e.alpha !== 'number' || Number.isNaN(e.alpha)) {
            return null;
        }

        if (e.absolute === false && window.ondeviceorientationabsolute !== undefined) {
            return null;
        }

        return (360 - e.alpha + 360) % 360;
    }

    _shortestAngleDelta(from, to) {
        return ((to - from + 540) % 360) - 180;
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Hide loading and show app after a short moment
    const loading = document.getElementById('loading');
    const app = document.getElementById('main-content');

    new IslamTimes();

    // Fade out loading screen
    const isAndroid = /Android/i.test(navigator.userAgent);
    const revealDelay = isAndroid ? 120 : 260;

    setTimeout(() => {
        if (app) { app.style.opacity = '1'; }
        if (loading) {
            loading.style.opacity = '0';
            loading.style.pointerEvents = 'none';
        }
        setTimeout(() => loading?.remove(), 500);
    }, revealDelay);
});

// ─── Service Worker registration ──────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(r => console.log('SW registered:', r.scope))
            .catch(e => console.log('SW error:', e));
    });
}
