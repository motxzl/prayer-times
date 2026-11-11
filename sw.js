// PrayerTimes service worker — scope-safe, resilient asset caching.
const CACHE_NAME = 'prayertimes-v2';
const APP_ROOT = new URL('./', self.registration.scope);
const CORE_ASSETS = ['index.html', 'style.css', 'script.js', 'manifest.json']
    .map(path => new URL(path, APP_ROOT).href);

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(CORE_ASSETS.map(async url => {
            try {
                const response = await fetch(url, { cache: 'reload' });
                if (response.ok) await cache.put(url, response);
            } catch (error) {
                console.warn('Precache skipped:', url, error);
            }
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('prayertimes-') && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request);
            if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
            return response;
        } catch (error) {
            const cached = await cache.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') {
                return (await cache.match(new URL('index.html', APP_ROOT).href)) ||
                    new Response('You are offline. Reconnect and reload PrayerTimes.', {
                        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    });
            }
            throw error;
        }
    })());
});
