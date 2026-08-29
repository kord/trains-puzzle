// Minimal offline service worker for the Train Tracks PWA.
// Registered only in production builds (see src/main.tsx).
const CACHE = 'train-tracks-v1'
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
            .then(() => self.clients.claim()),
    )
})

self.addEventListener('fetch', (event) => {
    const { request } = event
    if (request.method !== 'GET') return
    if (new URL(request.url).origin !== self.location.origin) return

    // Stale-while-revalidate for same-origin requests.
    event.respondWith(
        caches.open(CACHE).then(async (cache) => {
            const cached = await cache.match(request)
            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) cache.put(request, response.clone())
                    return response
                })
                .catch(() => cached)
            return cached || network
        }),
    )
})
