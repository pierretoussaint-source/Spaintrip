/**
 * Roadtrip Explorer - Application Core
 * ES6 Vanilla JavaScript - Pas de dépendances (sauf Leaflet via CDN)
 */

class RoadtripApp {
    constructor() {
        // Configuration initiale
        this.config = {
            mapCenter: [42.6, 1.8], // Centre approximatif du roadtrip (Pyrénées/Catalogne)
            defaultZoom: 8,
            tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            tileOptions: {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            },
            // Fichiers de données à charger
            dataSources: [
                'data/bivouacs.json',
                'data/campings.json',
                'data/spots.json',
                'data/baignades.json',
                'data/restaurants.json',
                'data/parkings.json',
                'data/stations.json',
                'data/supermarches.json'
            ]
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

        // Mapping des catégories avec leurs emojis/couleurs
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
     * Enregistre le Service Worker pour la PWA et le cache
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => console.log('✅ Service Worker enregistré avec succès.', reg.scope))
                    .catch(err => console.error('❌ Échec de l\'enregistrement du Service Worker:', err));
            });
        }
    }

    /**
     * Initialise la carte Leaflet
     */
    initMap() {
        // Création de la carte
        this.state.map = L.map('map', {
            zoomControl: false // On désactive pour repositionner si besoin, ou pour le design mobile
        }).setView(this.config.mapCenter, this.config.defaultZoom);

        // Ajout du fond de carte OpenStreetMap
        L.tileLayer(this.config.tileLayer, this.config.tileOptions).addTo(this.state.map);

        // Ajout des contrôles de zoom en bas à droite pour ne pas gêner le header
        L.control.zoom({ position: 'bottomright' }).addTo(this.state.map);

        // Groupe de calques pour les marqueurs (permet de les vider facilement lors du filtrage)
        this.state.markersLayer = L.featureGroup().addTo(this.state.map);
    }

    /**
     * Charge tous les fichiers JSON en parallèle
     */
    async loadData() {
        try {
            // 1. Charger l'itinéraire
            const routeResponse = await fetch('data/itineraire.json');
            if (routeResponse.ok) {
                const routeData = await routeResponse.json();
                this.drawRoute(routeData.coordinates);
            }

            // 2. Charger tous les POIs
            const fetchPromises = this.config.dataSources.map(url => 
                fetch(url).then(res => res.ok ? res.json() : [])
            );

            const results = await Promise.all(fetchPromises);
            
            // Aplatir le tableau de tableaux en un seul tableau d'objets
            this.state.allPOIs = results.flat();

            // Afficher les marqueurs
            this.renderMarkers(this.state.allPOIs);
            
        } catch (error) {
            console.error("Erreur lors du chargement des données JSON:", error);
            // Fallback UX : afficher un message d'erreur
            alert("Impossible de charger les données. Vérifiez votre connexion.");
        }
    }

    /**
     * Dessine la polyligne du roadtrip sur la carte
     * @param {Array} coordinates - Tableau de [lat, lng]
     */
    drawRoute(coordinates) {
        if (!coordinates || coordinates.length === 0) return;

        this.state.routeLayer = L.polyline(coordinates, {
            color: '#2d6a4f', // Vert forêt
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10', // Style pointillé pour le trajet
            lineJoin: 'round'
        }).addTo(this.state.map);

        // Ajuster la vue pour voir tout le trajet au démarrage
        this.state.map.fitBounds(this.state.routeLayer.getBounds(), { padding: [50, 50] });
    }

    /**
     * Affiche les marqueurs sur la carte selon les données filtrées
     * @param {Array} pois - Liste des points d'intérêt
     */
    renderMarkers(pois) {
        // Vider les anciens marqueurs
        this.state.markersLayer.clearLayers();

        pois.forEach(poi => {
            // Création d'une icône customisée avec l'emoji correspondant
            const emoji = this.categoryIcons[poi.category] || '📍';
            
            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="background-color: #1E1E1E; border: 2px solid #2d6a4f; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">${emoji}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15] // Centrer l'icône sur le point
            });

            const marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
            
            // Événement au clic sur un marqueur
            marker.on('click', () => {
                this.openBottomSheet(poi);
                this.state.map.flyTo([poi.lat, poi.lng], 14, { duration: 0.5 });
            });

            this.state.markersLayer.addLayer(marker);
        });
    }

    /**
     * Gestion de l'interface utilisateur "Bottom Sheet"
     */
    openBottomSheet(poi) {
        const sheet = document.getElementById('poi-bottom-sheet');
        
        // Remplissage des données
        document.getElementById('poi-title').textContent = poi.name;
        document.getElementById('poi-category').textContent = this.categoryIcons[poi.category] + " " + poi.category;
        document.getElementById('poi-description').textContent = poi.description || "Aucune description disponible.";
        
        // Image
        const imgEl = document.getElementById('poi-image');
        imgEl.src = poi.image || 'assets/images/placeholder.jpg';
        imgEl.style.display = 'block';

        // Métadonnées
        document.getElementById('poi-time').textContent = poi.recommendedTime || "--";
        document.getElementById('poi-price').textContent = poi.price || "Gratuit";
        document.getElementById('poi-coords').textContent = `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`;

        // Sections conditionnelles (Conseils & Règles)
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

        // Lien Google Maps
        const gmapsLink = document.getElementById('poi-gmaps-link');
        gmapsLink.href = poi.gmapsUrl || `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`;

        // Afficher la Bottom Sheet
        sheet.classList.add('open');
    }

    closeBottomSheet() {
        document.getElementById('poi-bottom-sheet').classList.remove('open');
    }

    /**
     * Géolocalisation de l'utilisateur
     */
    locateUser() {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée par votre navigateur.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.state.userLocation = [latitude, longitude];

                // Afficher/Déplacer le marqueur utilisateur
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
                console.error("Erreur de géolocalisation:", error);
                alert("Impossible de vous localiser. Vérifiez vos permissions.");
            },
            { enableHighAccuracy: true }
        );
    }

    /**
     * Math: Formule de Haversine pour calculer la distance entre deux coordonnées GPS
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Rayon de la terre en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
    }

    /**
     * Trouve le prochain camping/bivouac et affiche la distance
     */
    calculateNextStopDistance(userLat, userLng) {
        // Filtrer uniquement les lieux pour dormir
        const sleepSpots = this.state.allPOIs.filter(poi => poi.category === 'campings' || poi.category === 'bivouacs');
        
        if (sleepSpots.length === 0) return;

        let nearestDist = Infinity;
        
        sleepSpots.forEach(spot => {
            const dist = this.calculateDistance(userLat, userLng, spot.lat, spot.lng);
            if (dist < nearestDist) {
                nearestDist = dist;
            }
        });

        const indicator = document.getElementById('distance-indicator');
        const distText = document.getElementById('next-stop-dist');
        
        distText.textContent = `${nearestDist.toFixed(1)} km`;
        indicator.classList.remove('hidden');
    }

    /**
     * Gestion des événements DOM
     */
    bindEvents() {
        // Filtrage via les chips
        const filters = document.querySelectorAll('.filter-chip');
        filters.forEach(chip => {
            chip.addEventListener('click', (e) => {
                // Gestion de la classe active
                filters.forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');

                // Filtrage des données
                const filterValue = e.target.getAttribute('data-filter');
                this.state.currentFilter = filterValue;
                
                if (filterValue === 'all') {
                    this.renderMarkers(this.state.allPOIs);
                } else {
                    const filtered = this.state.allPOIs.filter(poi => poi.category === filterValue);
                    this.renderMarkers(filtered);
                }
                this.closeBottomSheet(); // Fermer la modale si ouverte
            });
        });

        // Recherche textuelle simple
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = this.state.allPOIs.filter(poi => 
                poi.name.toLowerCase().includes(term) || 
                (poi.description && poi.description.toLowerCase().includes(term))
            );
            this.renderMarkers(filtered);
        });

        // Bouton de localisation
        document.getElementById('btn-locate').addEventListener('click', () => {
            this.locateUser();
        });

        // Fermer la bottom sheet en cliquant sur la carte ou en "tirant" la poignée
        this.state.map.on('click', () => this.closeBottomSheet());
        document.querySelector('.sheet-handle').addEventListener('click', () => this.closeBottomSheet());
        
        // Ajout d'une animation simple dans le CSS dynamiquement pour le marqueur GPS
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

// Initialiser l'application quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RoadtripApp();
});
