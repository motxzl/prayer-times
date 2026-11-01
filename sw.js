// PrayerTimes service worker — scoped paths work on custom domains and GitHub Pages.
const CACHE_NAME = 'prayertimes-v2.0.0';
const APP_SHELL = ['./', './index.html', './style.css', './script.js', './manifest.json'];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(APP_SHELL.map(async path => {
            const url = new URL(path, self.registration.scope);
            const response = await fetch(url, { cache: 'reload' });
            if (response.ok) await cache.put(url, response);
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('prayertimes-') && key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Always try the network for app documents so deployments are not trapped
    // behind an old cached HTML/JS bundle. Fall back to the cached shell offline.
    if (request.mode === 'navigate' || /\\.(?:html|js|css)$/.test(url.pathname)) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                const fresh = await fetch(request);
                if (fresh.ok) await cache.put(request, fresh.clone());
                return fresh;
            } catch (_) {
                return (await cache.match(request)) ||
                    (request.mode === 'navigate' ? await cache.match(new URL('./index.html', self.registration.scope)) : Response.error());
            }
        })());
        return;
    }

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
            const response = await fetch(request);
            if (response.ok) await cache.put(request, response.clone());
            return response;
        } catch (_) {
            return Response.error();
        }
    })());
});
