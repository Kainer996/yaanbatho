// QuarryPro - Settings Manager v2.0

class SettingsManager {
    constructor() {
        this.settings = {};
        this.setupEventListeners();
        this.load(); // Load immediately for global use
    }

    async load() {
        try {
            const response = await fetch('api/settings');
            this.settings = await response.json();
            this.populateForm();

            // Expose globally needed settings
            window._shiftStartHour = parseInt(this.settings.shift_start_hour || '6');

            // Update site name in header
            const siteEl = document.getElementById('site-name-display');
            if (siteEl && this.settings.site_name) siteEl.textContent = this.settings.site_name;
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    populateForm() {
        const s = this.settings;
        this.setVal('s-site-name', s.site_name || '');
        this.setVal('s-shift-start', s.shift_start_hour || '6');
        this.setVal('s-daily-target', s.daily_target_tonnes || '2000');
        this.setVal('s-cost-per-tonne', s.cost_per_tonne || '4.50');
        this.setVal('s-fuel-alert', s.alert_fuel_low || '25');
        this.setVal('s-hours-alert', s.alert_hours_service || '50');
    }

    setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const saveBtn = document.getElementById('saveSettings');
            if (saveBtn) saveBtn.addEventListener('click', () => this.save());
        });
    }

    async save() {
        const data = {
            site_name: document.getElementById('s-site-name')?.value || 'Bankfield Quarry',
            shift_start_hour: document.getElementById('s-shift-start')?.value || '6',
            daily_target_tonnes: document.getElementById('s-daily-target')?.value || '2000',
            cost_per_tonne: document.getElementById('s-cost-per-tonne')?.value || '4.50',
            alert_fuel_low: document.getElementById('s-fuel-alert')?.value || '25',
            alert_hours_service: document.getElementById('s-hours-alert')?.value || '50'
        };

        try {
            await fetch('api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            // Apply immediately
            window._shiftStartHour = parseInt(data.shift_start_hour);
            const siteEl = document.getElementById('site-name-display');
            if (siteEl) siteEl.textContent = data.site_name;

            // Show saved message
            const msg = document.getElementById('settings-saved-msg');
            if (msg) {
                msg.style.display = 'inline';
                setTimeout(() => { msg.style.display = 'none'; }, 2500);
            }

            // Refresh KPIs with new settings
            if (window.kpiManager) kpiManager.refresh();
        } catch (e) {
            console.error('Failed to save settings:', e);
            alert('Failed to save settings');
        }
    }
}

let settingsManager;
document.addEventListener('DOMContentLoaded', () => {
    settingsManager = new SettingsManager();
});
