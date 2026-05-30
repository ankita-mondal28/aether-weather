'use strict';

const Settings = {
  _refreshTimer: null,

  open() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const s = Storage.getSettings();

    document.querySelectorAll('input[name="unit"]').forEach(r  => { r.checked  = r.value  === s.unit;  });
    document.querySelectorAll('input[name="theme"]').forEach(r => { r.checked = r.value === s.theme; });

    const sel = document.getElementById('auto-refresh-select');
    if (sel) sel.value = String(s.autoRefresh);

    const city = document.getElementById('default-city-input');
    if (city) city.value = s.defaultCity || CONFIG.DEFAULT_CITY;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Focus the first interactive element for accessibility
    setTimeout(() => modal.querySelector('input, button, select')?.focus(), 80);
  },

  close() {
    document.getElementById('settings-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  },

  save() {
    const unit    = document.querySelector('input[name="unit"]:checked')?.value   || 'celsius';
    const theme   = document.querySelector('input[name="theme"]:checked')?.value  || 'dark';
    const refresh = parseInt(document.getElementById('auto-refresh-select')?.value || '0', 10);
    const defCity = document.getElementById('default-city-input')?.value?.trim()  || CONFIG.DEFAULT_CITY;

    const prev = Storage.getSettings();
    Storage.saveSettings({ unit, theme, autoRefresh: refresh, defaultCity: defCity });

    // Apply theme immediately
    UI.applyTheme(theme);

    // If unit changed, re-render everything that shows temperatures
    if (prev.unit !== unit) {
      UI._unit = unit;
      UI.reRenderAll();
    }

    this.setupAutoRefresh(refresh);
    this.close();
    UI.notify('Settings saved.', 'success');
  },

  setupAutoRefresh(mins) {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    if (mins > 0) {
      this._refreshTimer = setInterval(() => window.App?.refresh(), mins * 60 * 1000);
    }
  },

  clearCities() {
    if (!confirm('Remove all saved cities? This cannot be undone.')) return;
    Storage.clearCities();
    UI.renderSavedCities([]);
    UI.notify('All saved cities cleared.', 'info');
  },

  resetApp() {
    if (!confirm('Reset Aether to defaults? All settings and cities will be lost.')) return;
    Storage.resetAll();
    UI.notify('Resetting…', 'info');
    setTimeout(() => location.reload(), 1000);
  },

  init() {
    document.getElementById('save-settings-btn')?.addEventListener('click', () => this.save());
    document.getElementById('settings-close')?.addEventListener('click',    () => this.close());

    // Click outside modal box to close
    document.getElementById('settings-modal')?.addEventListener('click', e => {
      if (e.target.id === 'settings-modal') this.close();
    });

    document.getElementById('clear-cities-btn')?.addEventListener('click', () => this.clearCities());
    document.getElementById('reset-app-btn')?.addEventListener('click',    () => this.resetApp());

    // ESC key closes any open modal
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      this.close();
      MapModule.close();
    });

    // Apply saved auto-refresh on boot
    this.setupAutoRefresh(Storage.getSettings().autoRefresh);
  },
};
