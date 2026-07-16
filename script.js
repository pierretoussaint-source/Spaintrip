/**
 * Roadtrip Explorer - Application Core
 * ES6 Vanilla JavaScript - Sans framework
 */

class RoadtripApp {
    constructor() {
        // Configuration de base
        this.config = {
            mapCenter: [42.6, 1.8],
            defaultZoom: 8,
            tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            tileOptions: {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            },
            routeSource: 'data/itineraire.json',
            poiSource: 'data/pois.json'
        };

        // État de l'application
        this.state = {
            map: null,
            markersLayer: null,
            routeLayer: null,
            allPOIs: [],
            userLocation: null,
            currentFilter: 'all'
        };

        // Dictionnaire des catégories (Avec les ajouts Activités et Astuces)
        this.categoryIcons = {
            'bivouacs': '🏕️',
            'campings': '⛺',
            'activites': '🛶',
            'astuces': '💡',
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

    async init() {
        this.registerServiceWorker();
        this.initMap();
        this.bindEvents();
        await this.loadData();
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(reg => console.log('✅ SW enregistré avec succès.', reg.scope))
                    .catch(err => console.error('❌ Échec SW:', err));
            });
        }
    }

    initMap() {
        this.state.map = L.map('map', {
            zoomControl: false
        }).setView(this.config.mapCenter, this.config.defaultZoom);

        L.tileLayer(this.config.tileLayer, this.config.tileOptions).addTo(this.state.map);
        L.control.zoom({ position: 'bottomright' }).addTo(this.state.map);
        
        this.state.markersLayer = L.featureGroup().addTo(this.state.map);
    }

    async loadData() {
        try {
            const routeRes = await fetch(this.config.routeSource);
            if (routeRes.ok) {
                const routeData = await routeRes.json();
                this.drawRoute(routeData.coordinates);
            }

            const poiRes = await fetch(this.config.poiSource);
            if (poiRes.ok) {
                this.state.allPOIs = await poiRes.json();
                this.renderMarkers(this.state.allPOIs);
            }
            
        } catch (error) {
            console.error("Erreur de chargement des données:", error);
        }
    }

    drawRoute(coordinates) {
        if (!coordinates || coordinates.length === 0) return;

        this.state.routeLayer = L.polyline(coordinates, {
            color: '#2d6a4f',
            weight: 4,
            opacity: 0.8,
            dashArray: '10, 10',
            lineJoin: 'round'
        }).addTo(this.state.map);

        this.state.map.fitBounds(this.state.routeLayer.getBounds(), { padding: [50, 50] });
    }

    renderMarkers(pois) {
        this.state.markersLayer.clearLayers();

        pois.forEach(poi => {
            const emoji = this.categoryIcons[poi.category] || '📍';
            
            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="background-color: #1E1E1E; border: 2px solid #2d6a4f; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">${emoji}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const marker = L.marker([poi.lat, poi.lng], { icon: customIcon });
            
            marker.on('click', () => {
                this.openBottomSheet(poi);
                this.state.map.flyTo([poi.lat, poi.lng], 14, { duration: 0.5 });
            });

            this.state.markersLayer.addLayer(marker);
        });
    }

    openBottomSheet(poi) {
        const sheet = document.getElementById('poi-bottom-sheet');
        
        document.getElementById('poi-title').textContent = poi.name;
        document.getElementById('poi-category').textContent = this.categoryIcons[poi.category] + " " + poi.category;
        document.getElementById('poi-description').textContent = poi.description || "Aucune description.";
        
        document.getElementById('poi-time').textContent = poi.recommendedTime || "--";
        document.getElementById('poi-price').textContent = poi.price || "Gratuit";
        document.getElementById('poi-coords').textContent = `${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}`;

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

        document.getElementById('poi-gmaps-link').href = `https://www.google.com/maps/search/?api=1&query=${poi.lat},${poi.lng}`;

        sheet.classList.add('open');
    }

    closeBottomSheet() {
        document.getElementById('poi-bottom-sheet').classList.remove('open');
    }

    locateUser() {
        if (!navigator.geolocation) {
            alert("La géolocalisation n'est pas supportée.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.state.userLocation = [latitude, longitude];

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

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
    }

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

    bindEvents() {
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

        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = this.state.allPOIs.filter(poi => 
                poi.name.toLowerCase().includes(term) || 
                (poi.description && poi.description.toLowerCase().includes(term))
            );
            this.renderMarkers(filtered);
        });

        document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());
        
        this.state.map.on('click', () => this.closeBottomSheet());
        document.querySelector('.sheet-handle').addEventListener('click', () => this.closeBottomSheet());
        
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

document.addEventListener('DOMContentLoaded', () => {
    window.app = new RoadtripApp();
});
