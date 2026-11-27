/**
 * Islam Times - Service Worker
 * Network-first for the app shell so a new deploy is never pinned behind an old cache.
 * The cache is only an offline fallback. API calls are never cached here.
 */
const CACHE = 'islamtimes-v5';
const SHELL = ['./', './index.html', './style.css', './script.js', './manifest.json',
    './icons/app-icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // One missing file must not fail the whole install.
        await Promise.all(SHELL.map(async u => {
            try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await cache.put(u, r); } catch (_) {}
        }));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    // Prayer/geocoding APIs: straight to the network.
    if (/aladhan\.com|bigdatacloud\.net|open-meteo\.com/.test(url.hostname)) return;
    e.respondWith((async () => {
        const cache = await caches.open(CACHE);
        try {
            const res = await fetch(req);
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
            return res;
        } catch (err) {
            const hit = await cache.match(req, { ignoreSearch: true });
            if (hit) return hit;
            if (req.mode === 'navigate') {
                const idx = await cache.match('./index.html');
                if (idx) return idx;
            }
            return Response.error();
        }
    })());
});
