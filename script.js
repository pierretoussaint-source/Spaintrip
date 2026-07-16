/**
 * Roadtrip Explorer - Application Core
 * ES6 Vanilla JavaScript - Sans framework
 */

class RoadtripApp {
    constructor() {
        // Configuration de base
        this.config = {
            mapCenter: [42.6, 1.8], // Centre (Pyrénées / Catalogne)
            defaultZoom: 8,
            tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            tileOptions: {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            },
            // Fichiers de données (Itinéraire + Fichier unique POIs)
            routeSource: 'data/itineraire.json',
            poiSource: 'data/pois.json'
        };

        // État de l'application
        this.state = {
            map: null,
            markersLayer: null,
            routeLayer: null,
            allPOIs: [], // Stocke tous les Points d'Intérêt
            userLocation: null,
            currentFilter: 'all'
        };

        // Dictionnaire des catégories (Emojis et libellés)
        this.categoryIcons = {
            'bivouacs': '🏕️',
            'campings': '⛺',
            'points-de-vue': '📸',
            'randonnees': '🥾',
            'baignades': '🏖',
            'eau': '💧',
            'douches': '🚿',
            'toilettes': '🚻',
            'stations': '⛽',
            'supermarches': '🛒',
            'restaurants': '🍴',
            'parkings': '🚐'
        };

        this.init();
    }

    /**
     * Initialisation globale
     */
    async init() {
        this.registerServiceWorker();
        this.initMap();
        this.bindEvents();
        await this.loadData();
    }

    /**
     * Enregistre le Service Worker (PWA & Mode Hors-ligne)
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => console.log('✅ SW enregistré avec succès.', reg.scope))
                    .catch(err => console.error('❌ Échec SW:', err));
            });
        }
    }

    /**
     * Initialise la carte Leaflet
     */
    initMap() {
        this.state.map = L.map('map', {
            zoomControl: false // Désactivé pour le design mobile, on le remet en bas
        }).setView(this.config.mapCenter, this.config.defaultZoom);

        L.tileLayer(this.config.tileLayer, this.config.tileOptions).addTo(this.state.map);
        L.control.zoom({ position: 'bottomright' }).addTo(this.state.map);
        
        // Calque dédié aux marqueurs pour faciliter le nettoyage (filtres)
        this.state.markersLayer = L.featureGroup().addTo(this.state.map);
    }

    /**
     * Charge l'itinéraire et les points d'intérêt depuis les JSON
     */
    async loadData() {
        try {
            // 1. Charger la polyligne de l'itinéraire
            const routeRes = await fetch(this.config.routeSource);
            if (routeRes.ok) {
                const routeData = await routeRes.json();
                this.drawRoute(routeData.coordinates);
            }

            // 2. Charger le fichier unique des POIs
            const poiRes = await fetch(this.config.poiSource);
            if (poiRes.ok) {
                this.state.allPOIs = await poiRes.json();
                this.renderMarkers(this.state.allPOIs);
            }
            
        } catch (error) {
            console.error("Erreur de chargement des données (hors-ligne ou fichier introuvable):", error);
        }
    }

    /**
     * Dessine le tracé du roadtrip
     * @param {Array} coordinates - Tableau de [lat, lng]
     */
    drawRoute(coordinates) {
        if (!coordinates || coordinates.length === 0) return;

        this.state.routeLayer = L.polyline(coordinates, {
            color: '#2d6a4f', // Vert forêt
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10',
            lineJoin: 'round'
        }).addTo(this.state.map);

        // Recadrer la vue sur l'itinéraire complet au démarrage
        this.state.map.fitBounds(this.state.routeLayer.getBounds(), { padding: [50, 50] });
    }

    /**
     * Affiche les marqueurs sur la carte
     * @param {Array} pois - Données à afficher
     */
    renderMarkers(pois) {
        this.state.markersLayer.clearLayers();

        pois.forEach(poi => {
            const emoji = this.categoryIcons[poi.category] || '📍';
            
            // Création du marqueur minimaliste (optimisé hors-ligne, sans images)
            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="background-color: #1E1E1E; border: 2px solid #2d6a4f; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">${emoji}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
            
            marker.on('click', () => {
                this.openBottomSheet(poi);
                // Animation fluide de la caméra vers le point cliqué
                this.state.map.flyTo([poi.lat, poi.lng], 14, { duration: 0.5 });
            });

            this.state.markersLayer.addLayer(marker);
        });
    }

    /**
     * Ouvre et peuple le tiroir du bas (Bottom Sheet)
     */
    openBottomSheet(poi) {
        const sheet = document.getElementById('poi-bottom-sheet');
        
        // Remplissage texte
        document.getElementById('poi-title').textContent = poi.name;
        document.getElementById('poi-category').textContent = this.categoryIcons[poi.category] + " " + poi.category;
        document.getElementById('poi-description').textContent = poi.description || "Aucune description.";
        
        // Métadonnées
        document.getElementById('poi-time').textContent = poi.recommendedTime || "--";
        document.getElementById('poi-price').textContent = poi.price || "Gratuit";
        document.getElementById('poi-coords').textContent = `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`;

        // Sections conditionnelles
        const tipsContainer = document.getElementById('poi-tips-container');
        if (poi.tips) {
            document.getElementById('poi-tips').textContent = poi.tips;
            tipsContainer.classList.remove('hidden');
        } else {
            tipsContainer.classList.add('hidden');
        }

        const rulesContainer = document.getElementById('poi-rules-container');
        if (poi.rules) {
            document.getElementById('poi-rules').textContent = poi.rules;
            rulesContainer.classList.remove('hidden');
        } else {
            rulesContainer.classList.add('hidden');
        }

        // Génération du lien Google Maps
        document.getElementById('poi-gmaps-link').href = `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`;

        sheet.classList.add('open');
    }

    closeBottomSheet() {
        document.getElementById('poi-bottom-sheet').classList.remove('open');
    }

    /**
     * Fonctionnalité GPS
     */
    locateUser() {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.state.userLocation = [latitude, longitude];

                // Marqueur utilisateur avec animation (Pulse)
                if (!this.userMarker) {
                    const userIcon = L.divIcon({
                        className: 'user-marker',
                        html: `<div style="background-color: #0077b6; border: 3px solid #fff; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 0 10px rgba(0,119,182,0.8); animation: pulse 2s infinite;"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });
                    this.userMarker = L.marker([latitude, longitude], { icon: userIcon, zIndexOffset: 1000 }).addTo(this.state.map);
                } else {
                    this.userMarker.setLatLng([latitude, longitude]);
                }

                this.state.map.flyTo([latitude, longitude], 13);
                this.calculateNextStopDistance(latitude, longitude);
            },
            (error) => {
                console.error("Erreur GPS:", error);
                alert("Géolocalisation impossible. Vérifiez vos permissions.");
            },
            { enableHighAccuracy: true }
        );
    }

    /**
     * Formule mathématique (Haversine) pour les distances GPS
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la Terre (km)
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
    }

    /**
     * Trouve le prochain point de chute (camping/bivouac/parking)
     */
    calculateNextStopDistance(userLat, userLng) {
        const sleepSpots = this.state.allPOIs.filter(poi => 
            ['campings', 'bivouacs', 'parkings'].includes(poi.category)
        );
        
        if (sleepSpots.length === 0) return;

        let nearestDist = Infinity;
        
        sleepSpots.forEach(spot => {
            const dist = this.calculateDistance(userLat, userLng, spot.lat, spot.lng);
            if (dist < nearestDist) {
                nearestDist = dist;
            }
        });

        const indicator = document.getElementById('distance-indicator');
        document.getElementById('next-stop-dist').textContent = `${nearestDist.toFixed(1)} km`;
        indicator.classList.remove('hidden');
    }

    /**
     * Initialisation des écouteurs d'événements DOM
     */
    bindEvents() {
        // Filtrage Chips
        const filters = document.querySelectorAll('.filter-chip');
        filters.forEach(chip => {
            chip.addEventListener('click', (e) => {
                filters.forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');

                const filterValue = e.target.getAttribute('data-filter');
                this.state.currentFilter = filterValue;
                
                if (filterValue === 'all') {
                    this.renderMarkers(this.state.allPOIs);
                } else {
                    const filtered = this.state.allPOIs.filter(poi => poi.category === filterValue);
                    this.renderMarkers(filtered);
                }
                this.closeBottomSheet();
            });
        });

        // Recherche par texte
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = this.state.allPOIs.filter(poi => 
                poi.name.toLowerCase().includes(term) || 
                (poi.description && poi.description.toLowerCase().includes(term))
            );
            this.renderMarkers(filtered);
        });

        // Boutons et UI
        document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());
        
        this.state.map.on('click', () => this.closeBottomSheet());
        document.querySelector('.sheet-handle').addEventListener('click', () => this.closeBottomSheet());
        
        // CSS injecté pour l'animation du point GPS
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(0, 119, 182, 0.7); }
                70% { box-shadow: 0 0 0 15px rgba(0, 119, 182, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 119, 182, 0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Lancement au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RoadtripApp();
});
