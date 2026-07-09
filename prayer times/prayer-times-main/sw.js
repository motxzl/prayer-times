/**
 * Islam Times — Service Worker
 * Caches core assets for offline use (cache-first strategy for app shell,
 * network-first for API calls so prayer times always stay fresh).
 */

const CACHE = 'islamtimes-v3';
const SHELL = ['/', '/index.html', '/style.css', '/script.js', '/manifest.json', '/icons/app-icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

// ─── Install: pre-cache app shell ──────────────────────────────────────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

// ─── Activate: remove old caches ───────────────────────────────────────
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// ─── Fetch: network-first for API, cache-first for assets ─────────────
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // API calls: always try network first, no caching
    if (url.hostname.includes('aladhan.com') ||
        url.hostname.includes('bigdatacloud.net') ||
        url.hostname.includes('open-meteo.com')) {
        e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // CDN (fonts, icons): cache-first
    if (url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.') || url.hostname.includes('cdn.tailwind')) {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, copy));
                return res;
            }))
        );
        return;
    }

    // App shell: cache-first, fallback to index.html for navigation
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return res;
            }).catch(() => {
                if (e.request.headers.get('accept')?.includes('text/html')) {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
