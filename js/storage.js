'use strict';

const Storage = {
  K: {
    SETTINGS: 'aether_settings',
    CITIES:   'aether_saved_cities',
    LAST_LOC: 'aether_last_location',
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  getSettings() {
    const defaults = {
      unit:        'celsius',
      theme:       'dark',
      autoRefresh: 0,
      defaultCity: CONFIG.DEFAULT_CITY,
    };
    try {
      const s = JSON.parse(localStorage.getItem(this.K.SETTINGS) || '{}');
      return { ...defaults, ...s };
    } catch { return defaults; }
  },

  saveSettings(s) {
    try { localStorage.setItem(this.K.SETTINGS, JSON.stringify(s)); } catch {}
  },

  // ── Last location ──────────────────────────────────────────────────────────
  getLastLocation() {
    try {
      const s = JSON.parse(localStorage.getItem(this.K.LAST_LOC) || '{}');
      return {
        city:    s.city    || CONFIG.DEFAULT_CITY,
        lat:     s.lat     || CONFIG.DEFAULT_LAT,
        lon:     s.lon     || CONFIG.DEFAULT_LON,
        country: s.country || 'IN',
      };
    } catch {
      return { city: CONFIG.DEFAULT_CITY, lat: CONFIG.DEFAULT_LAT, lon: CONFIG.DEFAULT_LON, country: 'IN' };
    }
  },

  saveLastLocation(city, lat, lon, country = '') {
    try {
      localStorage.setItem(this.K.LAST_LOC, JSON.stringify({ city, lat, lon, country }));
    } catch {}
  },

  // ── Saved cities ───────────────────────────────────────────────────────────
  getSavedCities() {
    try { return JSON.parse(localStorage.getItem(this.K.CITIES) || '[]'); }
    catch { return []; }
  },

  _saveCities(cities) {
    try { localStorage.setItem(this.K.CITIES, JSON.stringify(cities)); } catch {}
  },

  // Returns 'added' | 'exists' | 'limit'
  addCity(obj) {
    const cities = this.getSavedCities();
    if (cities.some(c => c.name.toLowerCase() === obj.name.toLowerCase() && c.country === obj.country))
      return 'exists';
    if (cities.length >= 20) return 'limit';
    cities.unshift({ ...obj, savedAt: Date.now() });
    this._saveCities(cities);
    return 'added';
  },

  updateCity(name, country, updates) {
    const cities = this.getSavedCities().map(c =>
      (c.name.toLowerCase() === name.toLowerCase() && c.country === country)
        ? { ...c, ...updates } : c
    );
    this._saveCities(cities);
  },

  removeCity(name, country) {
    this._saveCities(
      this.getSavedCities().filter(c =>
        !(c.name.toLowerCase() === name.toLowerCase() && c.country === country)
      )
    );
  },

  clearCities() { localStorage.removeItem(this.K.CITIES); },

  resetAll() {
    Object.values(this.K).forEach(k => localStorage.removeItem(k));
  },
};
