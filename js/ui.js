'use strict';

const UI = {
  // ── State ──────────────────────────────────────────────────────────────────
  _chart:         null,
  _forecastDays:  4,
  _weatherData:   null,
  _unit:          'celsius',
  _isDay:         true,
  _tzOffset:      0,      // utc_offset_seconds from API — critical for timezone correctness
  _clockInterval: null,
  _notifId:       0,

  // ── Safe executor ──────────────────────────────────────────────────────────
  _try(fn, fallback = '') {
    try { return fn(); } catch { return fallback; }
  },

  // ── DOM helper ─────────────────────────────────────────────────────────────
  _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },
  _el(id) { return document.getElementById(id); },

  // ── WMO lookup ─────────────────────────────────────────────────────────────
  wmo(code) {
    return CONFIG.WMO[parseInt(code, 10)] || CONFIG.WMO[0];
  },

  emoji(code) {
    return CONFIG.EMOJI[parseInt(code, 10)] || '🌡️';
  },

  iconUrl(code, isDay) {
    const w = this.wmo(code);
    return `${CONFIG.ICON_BASE}${isDay ? w.day : w.night}.svg`;
  },

  // ── Temperature ────────────────────────────────────────────────────────────
  dispTemp(c) {
    if (c == null || isNaN(c)) return '--';
    return this._unit === 'fahrenheit'
      ? String(Math.round(c * 9 / 5 + 32))
      : String(Math.round(c));
  },
  unitLabel() { return this._unit === 'fahrenheit' ? '°F' : '°C'; },

  // ── Wind ───────────────────────────────────────────────────────────────────
  windDir(deg) {
    if (deg == null || isNaN(deg)) return 'N';
    return CONFIG.WIND_DIRS[Math.round(deg / 22.5) % 16];
  },

  // ── AQI / UV ───────────────────────────────────────────────────────────────
  aqiCat(val) {
    if (val == null || isNaN(val)) return CONFIG.AQI[0];
    for (const c of CONFIG.AQI) { if (val <= c.max) return c; }
    return CONFIG.AQI.at(-1);
  },

  uvLabel(uv) {
    const v = uv ?? 0;
    for (const u of CONFIG.UV_LABELS) { if (v <= u.max) return u; }
    return CONFIG.UV_LABELS.at(-1);
  },

  // ── Timezone-aware time helpers ────────────────────────────────────────────

  // Current moment in the queried city's local time, as "YYYY-MM-DDTHH"
  _cityNowPrefix() {
    // Date.now() is UTC ms. Add location offset to get city-local ms.
    const cityMs = Date.now() + this._tzOffset * 1000;
    const d = new Date(cityMs);
    const p = n => String(n).padStart(2, '0');
    // Use UTC getters on the shifted value
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}`;
  },

  // Parse a city-local ISO string ("2024-03-21T05:34") to UTC ms
  // by treating the string as city-local and subtracting tzOffset
  _cityISOtoUTC(iso) {
    if (!iso) return NaN;
    // Append 'Z' to parse as UTC, then subtract tzOffset to get actual UTC
    const asIfUTC = Date.parse(iso.replace(' ', 'T') + 'Z');
    return asIfUTC - this._tzOffset * 1000;
  },

  // Format a city-local ISO time string "2024-03-21T14:30" → "2:30 PM"
  // Parsed directly from string — no timezone ambiguity
  _fmtTime(iso) {
    if (!iso) return '--';
    const h = parseInt(iso.slice(11, 13), 10);
    const m = iso.slice(14, 16);
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ap}`;
  },

  // Format "2024-03-21" date string, idx=0→Today, idx=1→Tomorrow
  _fmtDay(dateStr, idx) {
    if (!dateStr) return '--';
    if (idx === 0) return 'Today';
    if (idx === 1) return 'Tomorrow';
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  _isDay(rISO, sISO) {
    const now  = Date.now();
    const rise = this._cityISOtoUTC(rISO);
    const set  = this._cityISOtoUTC(sISO);
    return now >= rise && now <= set;
  },

  _daylightDuration(rISO, sISO) {
    return this._try(() => {
      const mins = Math.round((this._cityISOtoUTC(sISO) - this._cityISOtoUTC(rISO)) / 60000);
      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }, '--');
  },

  _daylightPct(rISO, sISO) {
    return this._try(() => {
      const now  = Date.now();
      const rise = this._cityISOtoUTC(rISO);
      const set  = this._cityISOtoUTC(sISO);
      if (now < rise) return 0;
      if (now > set)  return 100;
      return Math.round(((now - rise) / (set - rise)) * 100);
    }, 0);
  },

  // ── Hero ───────────────────────────────────────────────────────────────────
  renderHero(weather, city, country) {
    const c = weather.current;
    const d = weather.daily;

    // Store timezone offset for all subsequent time calculations
    this._tzOffset    = weather.utc_offset_seconds ?? 0;
    this._weatherData = weather;

    // Day/night from API's is_day field (most reliable) with sunrise fallback
    const isDay = c.is_day !== undefined ? c.is_day : this._isDay(d.sunrise?.[0], d.sunset?.[0]);
    this._isDay = isDay;

    const code = c.weather_code ?? 0;
    const info = this.wmo(code);
    const bg   = CONFIG.BG[info.bg] || CONFIG.BG.cloudy;

    // Background gradient
    const heroBg = this._el('hero-bg');
    if (heroBg) heroBg.style.background = isDay ? bg.day : bg.night;

    // Location
    this._set('city-name',     city    || 'Unknown');
    this._set('country-badge', country || '');

    // Condition text
    this._set('condition-label', info.label);
    this._set('condition-desc',
      `Feels like ${this.dispTemp(c.apparent_temperature)}${this.unitLabel()} · Humidity ${c.relative_humidity_2m ?? '--'}%`
    );

    // Weather icon — reset any previous error state, then load
    const heroIcon  = this._el('hero-icon');
    const heroEmoji = this._el('hero-icon-emoji');
    if (heroIcon) {
      heroIcon.style.display = '';     // reset hidden state
      if (heroEmoji) heroEmoji.style.display = 'none';
      heroIcon.src = this.iconUrl(code, isDay);
      heroIcon.alt = info.label;
      heroIcon.onerror = () => {
        heroIcon.style.display = 'none';
        if (heroEmoji) { heroEmoji.textContent = this.emoji(code); heroEmoji.style.display = 'block'; }
      };
    }

    // Temperature panel
    this._set('main-temp', this.dispTemp(c.temperature_2m));
    this._set('main-unit', this.unitLabel());
    this._set('wind-desc', `${this.windDir(c.winddirection_10m)}, ${Math.round(c.windspeed_10m ?? 0)} km/h`);
  },

  // ── Hourly strip ───────────────────────────────────────────────────────────
  renderHourly(weather) {
    const hourly = weather.hourly;
    const prefix = this._cityNowPrefix(); // city-local "YYYY-MM-DDTHH"

    // Find the current hour in the hourly time array (Open-Meteo times are city-local)
    let idx = hourly.time.findIndex(t => t.slice(0, 13) >= prefix);
    if (idx === -1) idx = 0;

    // Show next 8 hours
    const slots = [];
    for (let i = 0; i < 8 && (idx + i) < hourly.time.length; i++) {
      const j = idx + i;
      slots.push({
        time:     hourly.time[j],
        temp:     hourly.temperature_2m[j],
        code:     hourly.weather_code[j] ?? 0,
        rain:     hourly.precipitation_probability?.[j],
        wind:     hourly.windspeed_10m?.[j],
      });
    }

    const container = this._el('hourly-cards');
    if (container) {
      container.innerHTML = slots.map((s, i) => `
        <div class="hourly-card">
          <div class="h-time">${i === 0 ? 'Now' : this._fmtTime(s.time)}</div>
          <img class="h-icon" src="${this.iconUrl(s.code, this._isDay)}" alt="${this.wmo(s.code).label}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <span class="h-icon-fallback" style="display:none">${this.emoji(s.code)}</span>
          <div class="h-temp">${this.dispTemp(s.temp)}${this.unitLabel()}</div>
          <div class="h-rain">${s.rain != null ? `💧${s.rain}%` : ''}</div>
        </div>`).join('');
    }

    const labels = slots.map((s, i) => i === 0 ? 'Now' : this._fmtTime(s.time));
    const temps  = slots.map(s => s.temp != null ? Math.round(s.temp) : null);
    this._buildChart(labels, temps);
  },

  _buildChart(labels, temps) {
    const canvas = this._el('hourly-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (this._chart) { this._chart.destroy(); this._chart = null; }

    const h   = canvas.offsetHeight || 70;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(212,168,83,0.4)');
    grad.addColorStop(1, 'rgba(212,168,83,0.0)');

    this._chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: temps,
          borderColor: '#d4a853',
          backgroundColor: grad,
          borderWidth: 2.5,
          tension: 0.42,
          fill: true,
          pointRadius: 3.5,
          pointBackgroundColor: '#d4a853',
          pointBorderColor: 'rgba(255,255,255,0.85)',
          pointBorderWidth: 1.5,
          pointHoverRadius: 5.5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(6,8,16,0.92)',
            titleColor: 'rgba(238,242,248,0.55)',
            bodyColor: '#d4a853',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: { label: ctx => ` ${ctx.raw}°` },
          },
        },
        scales: { x: { display: false }, y: { display: false } },
        animation: { duration: 600, easing: 'easeOutQuart' },
      },
    });
  },

  // ── Forecast panel ─────────────────────────────────────────────────────────
  // BUG FIX: API now fetches 16 days; tabs are 4 / 10 / 16
  renderForecast(daily, days) {
    this._forecastDays = days;
    const list = this._el('forecast-list');
    if (!list || !daily?.time) return;

    const count = Math.min(days, daily.time.length); // never exceed what API returned
    let html = '';

    for (let i = 0; i < count; i++) {
      const code    = daily.weather_code?.[i] ?? 0;
      const info    = this.wmo(code);
      const rainPct = daily.precipitation_probability_max?.[i];
      const rainSum = daily.precipitation_sum?.[i];
      const maxWind = daily.windspeed_10m_max?.[i];

      html += `
        <div class="forecast-row">
          <span class="fc-day">${this._fmtDay(daily.time[i], i)}</span>
          <img class="fc-icon" src="${this.iconUrl(code, true)}" alt="${info.label}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
          <span class="fc-icon-fallback" style="display:none">${this.emoji(code)}</span>
          <span class="fc-cond">${info.label}</span>
          <span class="fc-rain" title="Rain probability">${rainPct != null ? `💧${rainPct}%` : ''}</span>
          <span class="fc-temps">
            <span class="fc-high">${this.dispTemp(daily.temperature_2m_max?.[i])}°</span>
            <span class="fc-low">${this.dispTemp(daily.temperature_2m_min?.[i])}°</span>
          </span>
        </div>`;
    }

    list.innerHTML = html || '<p class="aqi-na">No forecast data available.</p>';

    // Update active tab state
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
    });
  },

  // ── Air Conditions ─────────────────────────────────────────────────────────
  renderAirConditions(weather) {
    const c      = weather.current;
    const d      = weather.daily;
    const prefix = this._cityNowPrefix();
    const hIdx   = Math.max(0, weather.hourly.time.findIndex(t => t.slice(0, 13) >= prefix));

    this._set('feels-like',  `${this.dispTemp(c.apparent_temperature)}${this.unitLabel()}`);
    this._set('wind-speed',  `${Math.round(c.windspeed_10m ?? 0)} km/h`);
    this._set('rain-chance', `${weather.hourly.precipitation_probability?.[hIdx] ?? '--'}%`);
    this._set('humidity',    `${c.relative_humidity_2m ?? '--'}%`);

    const uv    = d.uv_index_max?.[0];
    const uvLbl = this.uvLabel(uv);
    const uvEl  = this._el('uv-index');
    if (uvEl) {
      uvEl.textContent = uv != null ? `${uv} · ${uvLbl.label}` : '--';
      uvEl.style.color = uvLbl.color;
    }
  },

  // ── AQI ────────────────────────────────────────────────────────────────────
  renderAQI(aqiData) {
    const section = this._el('aqi-section');
    if (!aqiData?.current) {
      if (section) section.innerHTML = `
        <div class="card-header"><h3>Air Quality</h3><span id="aqi-badge" class="aqi-badge" style="display:none"></span></div>
        <p class="aqi-na">Air quality data unavailable for this location.</p>`;
      return;
    }

    const cur = aqiData.current;
    const val = cur.european_aqi;
    const cat = this.aqiCat(val);

    this._set('aqi-score', val != null ? Math.round(val) : '--');

    const badge = this._el('aqi-badge');
    if (badge) {
      badge.textContent       = cat.label;
      badge.style.background  = cat.bg;
      badge.style.color       = cat.color;
      badge.style.display     = '';
    }

    this._set('aqi-desc', cat.desc);

    const fill = this._el('aqi-bar-fill');
    if (fill) {
      // BUG FIX: val != null (not val ? ...) — AQI of 0 is valid
      const pct = val != null ? Math.min(100, (val / 150) * 100) : 0;
      fill.style.width      = `${pct}%`;
      fill.style.background = cat.color;
    }

    this._set('pm25',  cur.pm2_5             != null ? `${cur.pm2_5.toFixed(1)} µg/m³`             : '--');
    this._set('pm10',  cur.pm10              != null ? `${cur.pm10.toFixed(1)} µg/m³`              : '--');
    this._set('ozone', cur.ozone             != null ? `${cur.ozone.toFixed(1)} µg/m³`             : '--');
    this._set('no2',   cur.nitrogen_dioxide  != null ? `${cur.nitrogen_dioxide.toFixed(1)} µg/m³`  : '--');
  },

  // ── Sunrise / Sunset ───────────────────────────────────────────────────────
  renderSunriseSunset(daily) {
    if (!daily?.sunrise?.[0]) return;
    const r = daily.sunrise[0];
    const s = daily.sunset[0];
    this._set('sunrise-time',      this._fmtTime(r));
    this._set('sunset-time',       this._fmtTime(s));
    this._set('daylight-duration', `Daylight · ${this._daylightDuration(r, s)}`);
    const prog = this._el('daylight-progress');
    if (prog) prog.style.width = `${this._daylightPct(r, s)}%`;
  },

  // ── Saved Cities ───────────────────────────────────────────────────────────
  renderSavedCities(cities) {
    const grid = this._el('saved-cities-grid');
    if (!grid) return;

    if (!cities?.length) {
      grid.innerHTML = `
        <div class="empty-cities">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
          </svg>
          <p>No saved cities</p>
          <span>Search a city then tap "+ Add Current City"</span>
        </div>`;
      return;
    }

    grid.innerHTML = cities.map(city => {
      // BUG FIX: use city.wmoCode (actual condition) not always 0
      const code     = city.wmoCode ?? 0;
      const iconSrc  = city.icon ? `${CONFIG.ICON_BASE}${city.icon}.svg` : '';
      const fallback = this.emoji(code);
      return `
      <div class="city-card glass-card" data-name="${this._esc(city.name)}" data-lat="${city.lat}" data-lon="${city.lon}" data-country="${this._esc(city.country)}">
        <button class="city-remove" data-name="${this._esc(city.name)}" data-country="${this._esc(city.country)}" aria-label="Remove ${this._esc(city.name)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <div class="city-top">
          <div>
            <div class="city-name">${this._esc(city.name)}</div>
            <div class="city-country">${this._esc(city.country)}</div>
          </div>
          ${iconSrc
            ? `<img class="city-icon" src="${iconSrc}" alt="" onerror="this.outerHTML='<span class=city-icon-emoji>${fallback}</span>'">`
            : `<span class="city-icon-emoji">${fallback}</span>`}
        </div>
        <div class="city-temp">${this.dispTemp(city.temp)}<span>${this.unitLabel()}</span></div>
        <div class="city-cond">${this._esc(city.condition)}</div>
        <div class="city-meta">
          <span>💧 ${city.humidity ?? '--'}%</span>
          <span>💨 ${city.windSpeed != null ? Math.round(city.windSpeed) : '--'} km/h</span>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.city-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.city-remove')) return;
        const { name, lat, lon, country } = card.dataset;
        window.App.loadWeather(parseFloat(lat), parseFloat(lon), name, country, false);
      });
    });

    grid.querySelectorAll('.city-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        Storage.removeCity(btn.dataset.name, btn.dataset.country);
        this.renderSavedCities(Storage.getSavedCities());
        this.notify(`${btn.dataset.name} removed.`, 'info');
      });
    });
  },

  // Escape HTML to prevent injection in city names
  _esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  },

  // Full re-render after unit change
  reRenderAll() {
    if (!this._weatherData) return;
    const wd = this._weatherData;
    this.renderHero(wd, window.App._currentCity, window.App._currentCountry);
    this.renderHourly(wd);
    this.renderForecast(wd.daily, this._forecastDays || 4);
    this.renderAirConditions(wd);
    this.renderSunriseSunset(wd.daily);
    this.renderSavedCities(Storage.getSavedCities());
  },

  // ── Clock ──────────────────────────────────────────────────────────────────
  startClock() {
    this._tickClock();
    if (this._clockInterval) clearInterval(this._clockInterval);
    this._clockInterval = setInterval(() => this._tickClock(), 1000);
  },

  _tickClock() {
    const n = new Date();
    this._set('current-time', n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    this._set('current-date', n.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  },

  // ── Loading overlay ────────────────────────────────────────────────────────
  showLoading() { this._el('loading-overlay')?.classList.remove('hidden'); },
  hideLoading() { this._el('loading-overlay')?.classList.add('hidden'); },

  // ── Error state in hero ────────────────────────────────────────────────────
  setError(isError, msg = '') {
    const lbl  = this._el('condition-label');
    const desc = this._el('condition-desc');
    const btn  = this._el('retry-btn');
    if (!lbl) return;
    if (isError) {
      lbl.textContent  = 'Unable to load weather';
      lbl.style.fontSize = '20px';
      if (desc) { desc.textContent = msg || 'Check your connection and try again.'; desc.style.color = 'rgba(248,113,113,0.85)'; }
      if (btn)  btn.style.display = 'inline-flex';
    } else {
      lbl.style.fontSize = '';
      if (desc) desc.style.color = '';
      if (btn)  btn.style.display = 'none';
    }
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notify(msg, type = 'info', duration = 3800) {
    const container = this._el('notif-container');
    if (!container) return;

    const id  = ++this._notifId;
    const div = document.createElement('div');
    div.className = `notif notif-${type}`;
    div.setAttribute('role', 'alert');
    div.innerHTML = `
      <span class="notif-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="notif-msg">${this._esc(msg)}</span>
      <button class="notif-close" aria-label="Dismiss">✕</button>`;

    div.querySelector('.notif-close').addEventListener('click', () => this._dismissNotif(div));
    container.appendChild(div);

    // Force reflow then animate in
    requestAnimationFrame(() => requestAnimationFrame(() => div.classList.add('notif-show')));

    setTimeout(() => this._dismissNotif(div), duration);
  },

  _dismissNotif(div) {
    if (!div.parentNode) return;
    div.classList.remove('notif-show');
    div.classList.add('notif-hide');
    setTimeout(() => div.remove(), 380);
  },

  // ── Theme ──────────────────────────────────────────────────────────────────
  applyTheme(theme) {
    document.body.classList.remove('light-mode', 'dark-mode');
    const isDark = theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme !== 'light';
    document.body.classList.add(isDark ? 'dark-mode' : 'light-mode');
    const icon = this._el('theme-icon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    // Sync mobile theme icon too
    const mobIcon = this._el('mob-theme-icon');
    if (mobIcon) mobIcon.textContent = isDark ? '☀️' : '🌙';
  },
};
