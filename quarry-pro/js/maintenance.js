// QuarryPro - Maintenance Records v2.3

class MaintenanceManager {
    constructor() {
        this.records = [];
        this.upcomingVehicles = [];
        this.init();
    }

    async init() {
        await this.refresh();
        this.setupEventListeners();
    }

    async refresh() {
        await Promise.all([
            this.loadRecords(),
            this.loadUpcomingService()
        ]);
        this.renderRecords();
    }

    async loadRecords() {
        try {
            const response = await fetch('api/maintenance');
            this.records = await response.json();
        } catch (e) {
            console.error('Failed to load maintenance records:', e);
            this.records = [];
        }
    }

    async loadUpcomingService() {
        try {
            const response = await fetch('api/fleet/upcoming-service');
            this.upcomingVehicles = await response.json();
        } catch (e) {
            this.upcomingVehicles = [];
        }
    }

    renderRecords() {
        const container = document.getElementById('maintenanceList');
        if (!container) return;

        // Summary header
        const totalCost = this.records.reduce((s, r) => s + parseFloat(r.cost || 0), 0);
        const thisMonth = this.records.filter(r => {
            const d = new Date(r.timestamp);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        const monthCost = thisMonth.reduce((s, r) => s + parseFloat(r.cost || 0), 0);

        container.innerHTML = `
            ${this.upcomingHTML()}
            <div class="maint-summary">
                <div class="stat-card">
                    <h3>Records Total</h3>
                    <div class="stat-value">${this.records.length}</div>
                </div>
                <div class="stat-card">
                    <h3>This Month</h3>
                    <div class="stat-value">${thisMonth.length} jobs</div>
                </div>
                <div class="stat-card">
                    <h3>Month Cost</h3>
                    <div class="stat-value">£${monthCost.toFixed(0)}</div>
                </div>
            </div>
            ${this.records.length === 0
                ? '<p class="info-text">No maintenance records. Log service work using "+ Log Service".</p>'
                : this.records.map(r => this.recordHTML(r)).join('')
            }
        `;
    }

    upcomingHTML() {
        if (!this.upcomingVehicles.length) return '';

        const overdueCount = this.upcomingVehicles.filter(v => v.overdue).length;
        const urgentCount  = this.upcomingVehicles.filter(v => !v.overdue && v.urgent).length;

        const summaryBadges = [
            overdueCount > 0 ? `<span class="alert-badge danger">${overdueCount} Overdue</span>` : '',
            urgentCount > 0  ? `<span class="alert-badge warn">${urgentCount} Due Soon</span>` : ''
        ].filter(Boolean).join(' ');

        const cards = this.upcomingVehicles.map(v => {
            const statusClass = v.overdue ? 'overdue' : v.urgent ? 'urgent' : 'ok';
            const fillClass   = statusClass;
            // Progress = hours since service / interval
            const pct = Math.min(100, v.service_interval_hours > 0
                ? ((v.hours - v.last_service_hours) / v.service_interval_hours) * 100
                : 0);
            const label = v.overdue
                ? `<strong style="color:var(--accent-red)">Overdue ${(v.hours - v.last_service_hours - v.service_interval_hours).toFixed(0)}h</strong>`
                : `Next in <strong>${parseFloat(v.hours_until_service).toFixed(0)}h</strong>`;

            return `
                <div class="upcoming-card ${statusClass}" title="${v.name}">
                    <div class="upcoming-vehicle-name">${v.name}</div>
                    <div class="upcoming-vehicle-type">${this.vehicleTypeLabel(v.type)}</div>
                    <div class="upcoming-hours-bar">
                        <div class="upcoming-hours-fill ${fillClass}" style="width:${pct}%"></div>
                    </div>
                    <div class="upcoming-label">${label}</div>
                    <div class="upcoming-label" style="margin-top:2px;">${parseFloat(v.hours).toFixed(0)}h / ${parseFloat(v.service_interval_hours).toFixed(0)}h interval</div>
                </div>`;
        }).join('');

        return `
            <div class="upcoming-service">
                <h3>🔔 Upcoming Service ${summaryBadges}</h3>
                <div class="upcoming-grid">${cards}</div>
            </div>`;
    }

    vehicleTypeLabel(type) {
        const map = {
            dumper: '🚛 Dumper',
            excavator: '🦾 Excavator',
            loader: '🏗️ Loader',
            dozer: '🚜 Dozer',
            grader: '🚧 Grader',
            crusher: '⚙️ Crusher',
            screener: '📐 Screener',
            other: '🔩 Other'
        };
        return map[type] || type || 'Vehicle';
    }

    recordHTML(r) {
        const ts = new Date(r.timestamp).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        const typeIcons = {
            service: '🔧', repair: '🛠️', inspection: '🔍',
            'oil-change': '🛢️', tyres: '🔵', welding: '⚡',
            electrical: '💡', hydraulics: '🔩', other: '📋'
        };
        const icon = typeIcons[r.type] || '📋';

        return `
            <div class="maint-record">
                <div class="maint-record-header">
                    <div>
                        <span class="maint-type-icon">${icon}</span>
                        <strong>${r.vehicle_name || 'Unknown'}</strong>
                        <span class="maint-type-label">${r.type}</span>
                    </div>
                    <div style="display:flex;gap:12px;align-items:center;">
                        ${r.cost > 0 ? `<span class="maint-cost">£${parseFloat(r.cost).toFixed(2)}</span>` : ''}
                        <span class="maint-date">${ts}</span>
                    </div>
                </div>
                ${r.description ? `<div class="maint-desc">${r.description}</div>` : ''}
                <div class="maint-meta">
                    ${r.hours_at_service ? `⏱ At ${parseFloat(r.hours_at_service).toFixed(0)}h` : ''}
                    ${r.next_service_hours ? ` · Next service: ${parseFloat(r.next_service_hours).toFixed(0)}h` : ''}
                    ${r.performed_by ? ` · 👷 ${r.performed_by}` : ''}
                </div>
            </div>`;
    }

    setupEventListeners() {
        const btn = document.getElementById('logService');
        if (btn) btn.addEventListener('click', () => this.showLogServiceModal());
    }

    showLogServiceModal() {
        const modal = document.getElementById('modal');
        const vehicles = window.fleetManager ? window.fleetManager.vehicles : [];

        document.getElementById('modalTitle').textContent = 'Log Service / Maintenance';
        document.getElementById('modalBody').innerHTML = `
            <form id="maintenanceForm">
                <div class="form-group">
                    <label>Vehicle *</label>
                    <select name="vehicle_id" required>
                        <option value="">Select vehicle...</option>
                        ${vehicles.map(v => {
                            const urgency = v.maintenance_due
                                ? ` ⚠️ Service Due`
                                : v.hours_to_service < 100
                                ? ` · ${v.hours_to_service}h to service`
                                : '';
                            return `<option value="${v.id}">${v.name} (${parseFloat(v.hours).toFixed(0)}h${urgency})</option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Service Type *</label>
                    <select name="type" required>
                        <option value="service">Scheduled Service</option>
                        <option value="oil-change">Oil / Filter Change</option>
                        <option value="repair">Repair</option>
                        <option value="inspection">Inspection / LOLER</option>
                        <option value="tyres">Tyres / Tracks</option>
                        <option value="hydraulics">Hydraulics</option>
                        <option value="electrical">Electrical</option>
                        <option value="welding">Welding / Fabrication</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="2" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-primary);padding:10px;border-radius:6px;font-size:14px;resize:vertical;" placeholder="What was done?"></textarea>
                </div>
                <div class="form-group">
                    <label>Hours at Service</label>
                    <input type="number" name="hours_at_service" step="0.1" placeholder="Current machine hours">
                </div>
                <div class="form-group">
                    <label>Next Service Due (hours)</label>
                    <input type="number" name="next_service_hours" step="10" placeholder="e.g. 1750">
                </div>
                <div class="form-group">
                    <label>Cost (£)</label>
                    <input type="number" name="cost" step="0.01" placeholder="0.00" value="0">
                </div>
                <div class="form-group">
                    <label>Performed By</label>
                    <input type="text" name="performed_by" placeholder="e.g. R. Smith, Finning UK">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Save Record</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('maintenanceForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            try {
                await fetch('api/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                modal.style.display = 'none';
                await this.refresh();
                // Refresh fleet so hours/service due flags update
                if (window.fleetManager) fleetManager.refresh();
                window.toast && window.toast('Service record saved successfully', 'success');
            } catch(err) {
                window.toast && window.toast('Failed to save service record', 'error');
            }
        });
    }
}

let maintenanceManager;
document.addEventListener('DOMContentLoaded', () => {
    maintenanceManager = new MaintenanceManager();
});
