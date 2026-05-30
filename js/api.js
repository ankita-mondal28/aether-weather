'use strict';

const API = {

  // ── Core fetch with AbortController timeout ────────────────────────────────
  async _fetch(url, ms = 12000) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
      throw new Error('Network error. Please check your internet connection.');
    }
  },

  // ── Geocoding ─────────────────────────────────────────────────────────────
  async getCoordinates(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`;
    const res  = await this._fetch(url);
    if (!res.ok) throw new Error(`Geocoding failed (${res.status}). Please try again.`);
    const data = await res.json();
    if (!data.results?.length)
      throw new Error(`"${city}" not found. Try adding a country code, e.g. "Paris, FR".`);
    // Return first result with display fields
    const r = data.results[0];
    return {
      latitude:    r.latitude,
      longitude:   r.longitude,
      name:        r.name,
      country_code: (r.country_code || '').toUpperCase(),
      country:     r.country || '',
      admin1:      r.admin1 || '',
    };
  },

  // ── Reverse geocode ────────────────────────────────────────────────────────
  async reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
    const res  = await this._fetch(url, 8000);
    if (!res.ok) throw new Error('Could not determine your location name.');
    const data = await res.json();
    const a    = data.address || {};
    return {
      city:         a.city || a.town || a.village || a.municipality || a.county || 'Unknown',
      country_code: (a.country_code || '').toUpperCase(),
      country:      a.country || '',
    };
  },

  // ── Main weather fetch ────────────────────────────────────────────────────
  // forecast_days=16 — Open-Meteo free tier maximum
  async getWeather(lat, lon) {
    const params = new URLSearchParams({
      latitude:  lat,
      longitude: lon,
      // Current conditions
      current: [
        'temperature_2m',
        'apparent_temperature',
        'weather_code',
        'windspeed_10m',
        'winddirection_10m',
        'relative_humidity_2m',
        'precipitation',
        'is_day',
      ].join(','),
      // Hourly (48 h window — first 24 are today, next 24 tomorrow)
      hourly: [
        'temperature_2m',
        'weather_code',
        'precipitation_probability',
        'windspeed_10m',
        'relativehumidity_2m',
      ].join(','),
      // Daily for the forecast panel
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'uv_index_max',
        'precipitation_probability_max',
        'precipitation_sum',
        'windspeed_10m_max',
      ].join(','),
      forecast_days:    String(CONFIG.FORECAST_MAX),
      timezone:         'auto',     // returns utc_offset_seconds in response
      temperature_unit: 'celsius',
      windspeed_unit:   'kmh',
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const res  = await this._fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Weather API error (${res.status}). ${body.slice(0, 120)}`);
    }

    const data = await res.json();
    if (!data.current) throw new Error('Unexpected API response. Please try again.');

    // Normalise: support both weather_code (current) and weathercode (legacy)
    const norm = obj => {
      if (!obj) return;
      if (obj.weathercode !== undefined && obj.weather_code === undefined)
        obj.weather_code = obj.weathercode;
    };
    norm(data.current);
    norm(data.hourly);
    norm(data.daily);

    // current.is_day may come as 1/0 integer
    data.current.is_day = !!data.current.is_day;

    return data; // includes utc_offset_seconds
  },

  // ── Air quality ────────────────────────────────────────────────────────────
  async getAirQuality(lat, lon) {
    const params = new URLSearchParams({
      latitude:  lat,
      longitude: lon,
      current:   'european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide',
      timezone:  'auto',
    });
    const res = await this._fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) throw new Error(`Air quality API error (${res.status}).`);
    return res.json();
  },

  // ── Minimal weather for saved-city cards ──────────────────────────────────
  async getMinimalWeather(lat, lon) {
    try {
      const params = new URLSearchParams({
        latitude: lat, longitude: lon,
        current:  'temperature_2m,weather_code,relative_humidity_2m,windspeed_10m',
        timezone: 'auto', temperature_unit: 'celsius',
      });
      const res = await this._fetch(`https://api.open-meteo.com/v1/forecast?${params}`, 8000);
      if (!res.ok) return null;
      const d = await res.json();
      if (d.current?.weathercode !== undefined && d.current?.weather_code === undefined)
        d.current.weather_code = d.current.weathercode;
      return d;
    } catch { return null; }
  },
};
