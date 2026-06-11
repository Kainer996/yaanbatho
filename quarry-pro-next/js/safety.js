// QuarryPro - Safety & Incidents v2.0

class SafetyManager {
    constructor() {
        this.incidents = [];
        this.init();
    }

    async init() {
        await this.refresh();
        this.setupEventListeners();
    }

    async refresh() {
        await this.loadAlerts();
        await this.loadIncidents();
        this.renderAlerts();
        this.renderIncidents();
    }

    async loadAlerts() {
        try {
            const response = await fetch('api/alerts');
            this.alerts = await response.json();
        } catch (e) {
            this.alerts = { low_fuel: [], maintenance_due: [], incidents_today: 0 };
        }
    }

    async loadIncidents() {
        try {
            const response = await fetch('api/incidents?limit=30');
            this.incidents = await response.json();
        } catch (e) {
            this.incidents = [];
        }
    }

    renderAlerts() {
        const container = document.getElementById('alertsSummary');
        if (!container) return;

        const { low_fuel = [], maintenance_due = [], incidents_today = 0 } = this.alerts || {};
        let html = '';

        if (low_fuel.length > 0) {
            html += `<div class="alerts-section">
                <h3>⛽ Low Fuel Alerts</h3>
                ${low_fuel.map(v => `
                    <div class="alert-item red">
                        <span>${v.name}</span>
                        <span>${parseFloat(v.fuel_level).toFixed(0)}% remaining</span>
                    </div>`).join('')}
            </div>`;
        }

        if (maintenance_due.length > 0) {
            html += `<div class="alerts-section">
                <h3>🔧 Maintenance Due</h3>
                ${maintenance_due.map(v => `
                    <div class="alert-item yellow">
                        <span>${v.name}</span>
                        <span>${parseFloat(v.hours_since_service).toFixed(0)}h since last service</span>
                    </div>`).join('')}
            </div>`;
        }

        if (low_fuel.length === 0 && maintenance_due.length === 0) {
            html += `<div style="padding:12px;background:var(--bg-tertiary);border-radius:8px;color:var(--accent-green);font-size:13px;margin-bottom:16px;">
                ✓ No active alerts — all systems normal
            </div>`;
        }

        if (incidents_today > 0) {
            html += `<div class="alert-item red" style="margin-bottom:16px;">
                <span>⚠️ Incidents today</span>
                <span>${incidents_today} reported</span>
            </div>`;
        }

        container.innerHTML = html;
    }

    renderIncidents() {
        const container = document.getElementById('incidentList');
        if (!container) return;

        if (this.incidents.length === 0) {
            container.innerHTML = '<p class="info-text">No incidents recorded. Stay safe out there. 🦺</p>';
            return;
        }

        container.innerHTML = this.incidents.map(inc => {
            const ts = new Date(inc.timestamp).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            return `
                <div class="incident-card ${inc.severity}">
                    <div class="incident-header">
                        <span class="incident-type">${this.typeIcon(inc.type)} ${inc.type}</span>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <span class="severity-pill ${inc.severity}">${inc.severity}</span>
                            <span class="incident-time">${ts}</span>
                        </div>
                    </div>
                    <div class="incident-desc">${inc.description}</div>
                    <div class="incident-meta">
                        ${inc.location ? `📍 ${inc.location}` : ''}
                        ${inc.vehicle_name ? ` · 🚛 ${inc.vehicle_name}` : ''}
                        ${inc.worker_name ? ` · 👷 ${inc.worker_name}` : ''}
                        ${inc.reported_by ? ` · Reported by: ${inc.reported_by}` : ''}
                    </div>
                    ${inc.action_taken ? `<div class="incident-meta" style="margin-top:4px;color:var(--accent-green);">✓ Action: ${inc.action_taken}</div>` : ''}
                </div>`;
        }).join('');
    }

    typeIcon(type) {
        const icons = {
            'near-miss': '⚠️', 'injury': '🩹', 'vehicle-incident': '🚛',
            'equipment-damage': '⚙️', 'environmental': '🌿', 'fire': '🔥',
            'spillage': '💧', 'unsafe-act': '🚫', 'property-damage': '🏗️'
        };
        return icons[type] || '📋';
    }

    setupEventListeners() {
        const btn = document.getElementById('logIncident');
        if (btn) btn.addEventListener('click', () => this.showIncidentModal());
    }

    showIncidentModal() {
        const modal = document.getElementById('modal');
        const vehicles = window.fleetManager ? window.fleetManager.vehicles : [];
        const workers = window.rosterManager ? window.rosterManager.workers : [];

        document.getElementById('modalTitle').textContent = 'Report Incident / Near-Miss';
        document.getElementById('modalBody').innerHTML = `
            <form id="incidentForm">
                <div class="form-group">
                    <label>Incident Type</label>
                    <select name="type" required>
                        <option value="near-miss">Near-Miss</option>
                        <option value="unsafe-act">Unsafe Act / Condition</option>
                        <option value="vehicle-incident">Vehicle Incident</option>
                        <option value="injury">Injury</option>
                        <option value="equipment-damage">Equipment Damage</option>
                        <option value="spillage">Spillage / Environmental</option>
                        <option value="fire">Fire</option>
                        <option value="property-damage">Property Damage</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Severity</label>
                    <select name="severity" required>
                        <option value="low">Low — Minor / Near-Miss</option>
                        <option value="medium">Medium — Lost Time / Property Damage</option>
                        <option value="high">High — Serious Injury / Major Damage</option>
                        <option value="critical">Critical — RIDDOR / Fatality</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description *</label>
                    <textarea name="description" required rows="3" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-primary);padding:10px;border-radius:6px;font-size:14px;resize:vertical;" placeholder="Describe what happened..."></textarea>
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input type="text" name="location" placeholder="e.g. Face A, Top of quarry, Plant">
                </div>
                <div class="form-group">
                    <label>Vehicle Involved</label>
                    <select name="vehicle_id">
                        <option value="">None / Not applicable</option>
                        ${vehicles.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Worker Involved</label>
                    <select name="worker_id">
                        <option value="">None / Not applicable</option>
                        ${workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Immediate Action Taken</label>
                    <input type="text" name="action_taken" placeholder="e.g. Area cordoned off, first aid given">
                </div>
                <div class="form-group">
                    <label>Reported By</label>
                    <input type="text" name="reported_by" placeholder="Your name">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Submit Report</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('incidentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            // Clear empty optional ids
            if (!data.vehicle_id) delete data.vehicle_id;
            if (!data.worker_id) delete data.worker_id;

            await fetch('api/incidents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            modal.style.display = 'none';
            await this.refresh();
        });
    }
}

let safetyManager;
document.addEventListener('DOMContentLoaded', () => {
    safetyManager = new SafetyManager();
});
