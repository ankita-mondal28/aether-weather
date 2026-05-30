'use strict';

const MapModule = {
  _map:            null,
  _marker:         null,
  _weatherLayer:   null,
  _activeLayer:    'temp',
  _lat:            CONFIG.DEFAULT_LAT,
  _lon:            CONFIG.DEFAULT_LON,
  _cityName:       CONFIG.DEFAULT_CITY,
  _listenersAdded: false,

  LAYERS: {
    temp:          { url: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${CONFIG.OWM_API_KEY}` },
    clouds:        { url: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${CONFIG.OWM_API_KEY}` },
    precipitation: { url: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${CONFIG.OWM_API_KEY}` },
    wind:          { url: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${CONFIG.OWM_API_KEY}` },
  },

  open(lat, lon, name) {
    this._lat      = lat;
    this._lon      = lon;
    this._cityName = name;

    // Show overlay
    const overlay = document.getElementById('map-overlay');
    if (!overlay) return;
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Sync layer button active state
    document.querySelectorAll('.layer-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.layer === this._activeLayer)
    );

    // Bind close/layer listeners once
    if (!this._listenersAdded) {
      this._bindListeners();
      this._listenersAdded = true;
    }

    // Wait one frame so the browser paints the overlay at full size,
    // THEN measure and init Leaflet. This is the reliable way.
    requestAnimationFrame(() => {
      const mapEl = document.getElementById('weather-map');
      if (!mapEl) return;

      // Set explicit pixel dimensions — Leaflet reads these at init time
      mapEl.style.width  = window.innerWidth  + 'px';
      mapEl.style.height = window.innerHeight + 'px';

      if (this._map) {
        this._map.invalidateSize({ animate: false });
        this._map.setView([lat, lon], 10, { animate: false });
        this._setMarker(lat, lon, name);
      } else {
        this._initMap();
      }
    });
  },

  _initMap() {
    if (this._map) return;

    this._map = L.map('weather-map', {
      zoomControl:        true,
      attributionControl: true,
    }).setView([this._lat, this._lon], 10);

    // Base OSM tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(this._map);

    // Weather overlay layer
    this._applyLayer(this._activeLayer);

    // City pin
    this._setMarker(this._lat, this._lon, this._cityName);
  },

  _applyLayer(key) {
    if (!this._map) return;
    if (this._weatherLayer) {
      this._map.removeLayer(this._weatherLayer);
      this._weatherLayer = null;
    }
    const cfg = this.LAYERS[key];
    if (!cfg) return;
    this._weatherLayer = L.tileLayer(cfg.url, { opacity: 0.55, maxZoom: 18 }).addTo(this._map);
    this._activeLayer  = key;
  },

  _setMarker(lat, lon, name) {
    if (!this._map) return;
    if (this._marker) { this._marker.remove(); this._marker = null; }

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#5b8af0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(91,138,240,0.6)"><div style="width:10px;height:10px;border-radius:50%;background:#fff;transform:rotate(45deg)"></div></div>`,
      iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -32],
    });

    this._marker = L.marker([lat, lon], { icon })
      .addTo(this._map)
      .bindPopup(`<b style="font-family:system-ui,sans-serif;font-size:13px">${name}</b>`)
      .openPopup();
  },

  _bindListeners() {
    // Layer toggle
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._applyLayer(btn.dataset.layer);
      });
    });

    // Close button — also wired via onclick in HTML as double safety
    document.getElementById('map-close')?.addEventListener('click', () => this.close());

    // Viewport resize — keep Leaflet container in sync
    window.addEventListener('resize', () => {
      if (!this._map) return;
      const overlay = document.getElementById('map-overlay');
      if (!overlay || overlay.style.display === 'none') return;
      const mapEl = document.getElementById('weather-map');
      if (mapEl) {
        mapEl.style.width  = window.innerWidth  + 'px';
        mapEl.style.height = window.innerHeight + 'px';
      }
      this._map.invalidateSize({ animate: false });
    });
  },

  updateLocation(lat, lon, name) {
    this._lat = lat; this._lon = lon; this._cityName = name;
    if (!this._map) return;
    const overlay = document.getElementById('map-overlay');
    if (!overlay || overlay.style.display === 'none') return;
    this._map.flyTo([lat, lon], 10, { animate: true, duration: 0.7 });
    this._setMarker(lat, lon, name);
  },

  close() {
    const overlay = document.getElementById('map-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  },
};
