const CACHE_NAME = 'roadtrip-cache-v1';

// Fichiers critiques à mettre en cache immédiatement (App Shell)
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Mise en cache des assets statiques');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Nettoyage ancien cache', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Interception des requêtes (Stratégie: Stale-while-revalidate pour les JSON, Cache-first pour le reste)
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Si c'est une requête vers un fichier JSON de données
    if (requestUrl.pathname.endsWith('.json') && requestUrl.pathname.includes('/data/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    // Tenter de récupérer depuis le réseau d'abord (Network First pour les données)
                    const networkResponse = await fetch(event.request);
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                } catch (error) {
                    // Si échec (hors-ligne), récupérer depuis le cache
                    return await cache.match(event.request);
                }
            })
        );
    } else {
        // Pour les autres assets (HTML, CSS, Map Tiles), Cache First
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                return cachedResponse || fetch(event.request).then(
                    (networkResponse) => {
                        // Mettre en cache les tuiles OpenStreetMap pour la navigation hors-ligne
                        if (requestUrl.hostname.includes('tile.openstreetmap.org')) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return networkResponse;
                    }
                );
            })
        );
    }
});
