'use strict';

const App = {
  _currentCity:    '',
  _currentCountry: '',
  _currentLat:     CONFIG.DEFAULT_LAT,
  _currentLon:     CONFIG.DEFAULT_LON,
  _lastSearchAt:   0,
  _isLoading:      false,

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  async init() {
    const s = Storage.getSettings();
    UI._unit = s.unit;
    UI.applyTheme(s.theme);
    UI.startClock();

    this._bindEvents();
    Settings.init();
    UI.renderSavedCities(Storage.getSavedCities());

    const loc = Storage.getLastLocation();
    await this.loadWeather(loc.lat, loc.lon, loc.city, loc.country, false);

    Settings.setupAutoRefresh(s.autoRefresh);
  },

  // ── Core weather load ──────────────────────────────────────────────────────
  async loadWeather(lat, lon, city, country, showNotif = true) {
    if (this._isLoading) return;
    this._isLoading = true;

    this._currentLat     = lat;
    this._currentLon     = lon;
    this._currentCity    = city;
    this._currentCountry = country;

    UI.showLoading();
    UI.setError(false);

    try {
      // Fire weather + AQI in parallel
      const [wRes, aRes] = await Promise.allSettled([
        API.getWeather(lat, lon),
        API.getAirQuality(lat, lon),
      ]);

      if (wRes.status === 'rejected') throw wRes.reason;
      const wd = wRes.value;

      // Render each panel independently — one crash never blocks others
      this._render('hero',         () => UI.renderHero(wd, city, country));
      this._render('hourly',       () => UI.renderHourly(wd));
      this._render('forecast',     () => UI.renderForecast(wd.daily, UI._forecastDays || 4));
      this._render('airCond',      () => UI.renderAirConditions(wd));
      this._render('sun',          () => UI.renderSunriseSunset(wd.daily));
      this._render('aqi',          () => UI.renderAQI(aRes.status === 'fulfilled' ? aRes.value : null));
      this._render('savedCities',  () => UI.renderSavedCities(Storage.getSavedCities()));

      // Update map if open
      MapModule.updateLocation(lat, lon, city);

      // Persist last location
      Storage.saveLastLocation(city, lat, lon, country);

      // Update search bar
      const inp = document.getElementById('search-input');
      if (inp) inp.value = city;

      if (showNotif) UI.notify(`Weather updated for ${city}.`, 'success');

    } catch (err) {
      console.error('[Aether] loadWeather error:', err);
      UI.notify(err.message || 'Failed to load weather data.', 'error', 7000);
      UI.setError(true, err.message);
    } finally {
      UI.hideLoading();
      this._isLoading = false;
    }
  },

  _render(name, fn) {
    try { fn(); }
    catch (err) { console.error(`[Aether] render(${name}) failed:`, err); }
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  async search(query) {
    const q = (query || '').trim();
    if (!q) { UI.notify('Enter a city name to search.', 'error'); return; }

    const now = Date.now();
    if (now - this._lastSearchAt < 1200) return; // debounce
    this._lastSearchAt = now;

    UI.showLoading();
    try {
      const r = await API.getCoordinates(q);
      await this.loadWeather(r.latitude, r.longitude, r.name, r.country_code, true);
    } catch (err) {
      console.error('[Aether] search error:', err);
      UI.notify(err.message || 'City not found.', 'error', 5000);
      UI.hideLoading();
    }
  },

  // ── Geolocation ────────────────────────────────────────────────────────────
  async geolocate() {
    if (!navigator.geolocation) {
      UI.notify('Geolocation is not supported by your browser.', 'error');
      return;
    }
    const btn = document.getElementById('geo-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="geo-pulse"></span> Locating…`;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords;
          const loc = await API.reverseGeocode(latitude, longitude);
          await this.loadWeather(latitude, longitude, loc.city, loc.country_code, false);
          UI.notify(`Located: ${loc.city}`, 'success');
        } catch (err) {
          UI.notify(err.message || 'Could not determine location.', 'error');
        } finally {
          this._resetGeoBtn(btn);
        }
      },
      err => {
        const msgs = {
          1: 'Location access denied. Enable it in browser settings.',
          2: 'Location unavailable. Please try again.',
          3: 'Location request timed out.',
        };
        UI.notify(msgs[err.code] || 'Geolocation failed.', 'error');
        this._resetGeoBtn(btn);
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
    );
  },

  _resetGeoBtn(btn) {
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
      </svg>
      <span class="geo-label">My Location</span>`;
  },

  // ── Add current city to saved list ─────────────────────────────────────────
  addCurrentCity() {
    if (!this._currentCity)  { UI.notify('No city loaded yet.',        'error'); return; }
    if (!UI._weatherData)    { UI.notify('Weather data not ready.',    'error'); return; }

    const c   = UI._weatherData.current;
    const code = c.weather_code ?? 0;
    const info = CONFIG.WMO[code] || CONFIG.WMO[0];

    const res = Storage.addCity({
      name:      this._currentCity,
      country:   this._currentCountry,
      lat:       this._currentLat,
      lon:       this._currentLon,
      temp:      c.temperature_2m,
      condition: info.label,
      humidity:  c.relative_humidity_2m,
      windSpeed: c.windspeed_10m,
      icon:      info.day,
      wmoCode:   code, // store actual code for correct emoji
    });

    if      (res === 'added')  { UI.renderSavedCities(Storage.getSavedCities()); UI.notify(`${this._currentCity} saved.`, 'success'); document.getElementById('saved-cities-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (res === 'exists') { UI.notify(`${this._currentCity} is already saved.`, 'info'); }
    else if (res === 'limit')  { UI.notify('Saved cities limit (20) reached.', 'error'); }
  },

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  async refresh() {
    if (!this._currentLat || this._isLoading) return;
    await this.loadWeather(this._currentLat, this._currentLon, this._currentCity, this._currentCountry, false);
  },

  // ── Toggle theme quickly ───────────────────────────────────────────────────
  _toggleTheme() {
    const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    const s = Storage.getSettings();
    s.theme = newTheme;
    Storage.saveSettings(s);
    UI.applyTheme(newTheme);
  },

  // ── Bind all events ────────────────────────────────────────────────────────
  _bindEvents() {
    const inp = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    btn?.addEventListener('click', () => this.search(inp?.value));
    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.search(inp.value); }
    });

    document.getElementById('geo-btn')?.addEventListener('click',      () => this.geolocate());
    document.getElementById('add-city-btn')?.addEventListener('click', () => this.addCurrentCity());
    document.getElementById('retry-btn')?.addEventListener('click',    () => this.refresh());

    // Sidebar nav
    document.getElementById('nav-cities')?.addEventListener('click',   () => document.getElementById('saved-cities-section')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('nav-map')?.addEventListener('click',      () => MapModule.open(this._currentLat, this._currentLon, this._currentCity));
    document.getElementById('nav-settings')?.addEventListener('click', () => Settings.open());
    document.getElementById('theme-toggle')?.addEventListener('click', () => this._toggleTheme());

    // Map

    // Forecast tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (UI._weatherData) UI.renderForecast(UI._weatherData.daily, parseInt(btn.dataset.days));
      });
    });

    // Mobile bottom nav
    document.getElementById('mob-cities')?.addEventListener('click',   () => document.getElementById('saved-cities-section')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('mob-map')?.addEventListener('click',      () => MapModule.open(this._currentLat, this._currentLon, this._currentCity));
    document.getElementById('mob-settings')?.addEventListener('click', () => Settings.open());
    document.getElementById('mob-theme')?.addEventListener('click',    () => this._toggleTheme()); // FIX: no more inline onclick

    // Subtle parallax on hero
    window.addEventListener('scroll', () => {
      const heroBg = document.getElementById('hero-bg');
      if (heroBg) heroBg.style.backgroundPositionY = `${window.scrollY * 0.18}px`;
    }, { passive: true });
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
