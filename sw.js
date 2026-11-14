/* TerusWA service worker — makes the app installable and usable offline. */
const VERSION = 'teruswa-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Never intercept WhatsApp links
    if (url.hostname === 'wa.me' || url.hostname.endsWith('whatsapp.com')) return;

    // Page navigations: network first, fall back to cached shell when offline
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(VERSION).then(c => c.put('index.html', copy));
                    return res;
                })
                .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
        );
        return;
    }

    // Everything else (own files + CDN scripts/fonts): stale-while-revalidate
    event.respondWith(
        caches.match(req).then(cached => {
            const network = fetch(req)
                .then(res => {
                    if (res && (res.ok || res.type === 'opaque')) {
                        const copy = res.clone();
                        caches.open(VERSION).then(c => c.put(req, copy));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
