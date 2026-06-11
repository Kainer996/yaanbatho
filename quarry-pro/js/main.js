// QuarryPro - Main App Controller v2.3

// ── Global Toast Notification System ──────────────────────────
window.toast = (function() {
    const container = () => document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️' };

    return function(message, type = 'info', durationMs = 3500) {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <span class="toast-msg">${message}</span>
            <span class="toast-dismiss" title="Dismiss">×</span>
        `;

        const dismiss = () => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 320);
        };

        el.querySelector('.toast-dismiss').addEventListener('click', dismiss);
        container().appendChild(el);

        // Auto-dismiss
        setTimeout(dismiss, durationMs);
    };
})();

// ── App Controller ─────────────────────────────────────────────
class App {
    constructor() {
        this.currentPanel = 'simulation';
        this.init();
    }

    async init() {
        await this.loadGlobalSettings();
        this.setupNavigation();
        this.setupModal();
        this.startClock();
        this.setupThemeToggle();

        // Mobile game pivot: launch straight into the playable simulator.
        this.showPanel('simulation');
    }

    // Load settings globally so all modules can use them
    async loadGlobalSettings() {
        try {
            const res = await fetch('api/settings');
            const settings = await res.json();
            window._shiftStartHour = parseInt(settings.shift_start_hour) || 6;
            window._dailyTarget = parseFloat(settings.daily_target_tonnes) || 2000;
            window._siteName = settings.site_name || 'Bankfield Quarry';

            // Apply site name in header
            const siteNameEl = document.getElementById('site-name-display');
            if (siteNameEl && window._siteName) siteNameEl.textContent = window._siteName;
        } catch (e) {
            window._shiftStartHour = 6;
            window._dailyTarget = 2000;
            window._siteName = 'Bankfield Quarry';
        }
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');

        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const panel = btn.dataset.panel;

                navButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this.showPanel(panel);
            });
        });
    }

    showPanel(panelName) {
        document.querySelectorAll('.panel').forEach(panel => {
            panel.style.display = 'none';
        });

        const panel = document.getElementById(`panel-${panelName}`);
        if (panel) {
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';
            this.currentPanel = panelName;
        }

        // Show/hide 3D map based on active tab
        const layout = document.querySelector('.main-layout');
        const mapContainer = document.querySelector('.map-container');
        if (panelName === 'map') {
            layout.classList.remove('hide-map');
            if (mapContainer) mapContainer.style.display = '';
            // Init (or resize) the 3D map now that container has real dimensions
            requestAnimationFrame(() => {
                if (typeof initMap3DIfNeeded === 'function') initMap3DIfNeeded();
            });
        } else {
            layout.classList.add('hide-map');
            if (mapContainer) mapContainer.style.display = 'none';
        }

        // Trigger refresh on panel switch
        if (panelName === 'safety' && window.safetyManager) {
            safetyManager.refresh();
        }
        if (panelName === 'kpi' && window.kpiManager) {
            kpiManager.refresh();
        }
        if (panelName === 'settings' && window.settingsManager) {
            settingsManager.load();
        }
        if (panelName === 'production' && window.productionManager) {
            productionManager.loadLogs().then(() => {
                productionManager.renderStats();
                productionManager.renderLogs();
                productionManager.updateChart();
            });
        }
        if (panelName === 'maintenance' && window.maintenanceManager) {
            maintenanceManager.refresh();
        }
        if (panelName === 'prestart' && window.preStartManager) {
            preStartManager.loadRecentChecks().then(() => preStartManager.renderRecentChecks());
        }
        if (panelName === 'roster' && window.rosterManager) {
            rosterManager.loadWorkers().then(() => rosterManager.renderWorkers());
        }
        if (panelName === 'stockpile' && window.stockpileManager) {
            stockpileManager.refresh();
        }
        if (panelName === 'handover' && window.handoverManager) {
            handoverManager.refresh();
        }
        if (panelName === 'analytics' && window.analyticsManager) {
            analyticsManager.refresh();
        }
        if (panelName === 'blasts' && window.blastManager) {
            blastManager.refresh();
        }
        if (panelName === 'simulation') {
            requestAnimationFrame(() => {
                if (typeof initSimulation === 'function') initSimulation();
                else if (quarrySim) quarrySim.resizeCanvas();
            });
        }
    }

    setupModal() {
        const modal = document.getElementById('modal');
        const closeBtn = document.querySelector('.modal-close');

        closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });

        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        // Load saved preference
        const saved = localStorage.getItem('qp-theme') || 'dark';
        this.applyTheme(saved, btn);

        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            this.applyTheme(next, btn);
            localStorage.setItem('qp-theme', next);
        });
    }

    applyTheme(theme, btn) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            if (btn) btn.textContent = '☀️';
            if (btn) btn.title = 'Switch to dark theme';
        } else {
            document.documentElement.removeAttribute('data-theme');
            if (btn) btn.textContent = '🌙';
            if (btn) btn.title = 'Switch to light theme';
        }
    }

    startClock() {
        const clockEl = document.getElementById('header-clock');
        const shiftEl = document.getElementById('shift-elapsed-badge');

        const tick = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleTimeString('en-GB', { hour12: false });

            const shiftStartHour = window._shiftStartHour || 6;
            const shiftStart = new Date(now);
            shiftStart.setHours(shiftStartHour, 0, 0, 0);
            if (now < shiftStart) shiftStart.setDate(shiftStart.getDate() - 1);
            const elapsed = Math.max(0, (now - shiftStart) / 3600000);
            shiftEl.textContent = `⏱ Shift: ${elapsed.toFixed(1)}h`;
        };
        tick();
        setInterval(tick, 1000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.app = app;
});
