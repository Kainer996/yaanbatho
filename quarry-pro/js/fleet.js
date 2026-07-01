// QuarryPro - Fleet Management v2.0

class FleetManager {
    constructor() {
        this.vehicles = [];
        this.init();
        window.addEventListener('qpro:simulation-snapshot', (event) => this.applySimulationSnapshot(event.detail));
    }

    async init() {
        await this.loadVehicles();
        this.renderVehicles();
        this.setupEventListeners();
        // Auto-refresh every 60 seconds
        setInterval(() => this.refresh(), 60000);
    }

    async loadVehicles() {
        try {
            const response = await fetch('api/vehicles');
            this.vehicles = await response.json();

            this.vehicles.forEach(v => {
                if (window.map3d) {
                    map3d.addVehicleMarker(v.id, v.name, v.type);
                    map3d.updateVehicleMarker(v.id, v.status);
                }
            });

            this.updateAlertBadge();
        } catch (error) {
            console.error('Failed to load vehicles:', error);
        }
    }

    async refresh() {
        await this.loadVehicles();
        this.renderVehicles();
    }

    updateAlertBadge() {
        const alertCount = this.vehicles.filter(v => v.fuel_alert || v.maintenance_due).length;
        const badge = document.getElementById('nav-alert-badge');
        if (badge) {
            badge.textContent = alertCount;
            badge.style.display = alertCount > 0 ? 'inline-block' : 'none';
        }
    }

    fuelBarHTML(fuelLevel) {
        const pct = Math.min(100, Math.max(0, fuelLevel));
        const cls = pct > 50 ? 'high' : pct > 25 ? 'mid' : 'low';
        return `
            <div class="fuel-bar-wrap">
                <div class="fuel-bar-label">
                    <span>⛽ Fuel</span>
                    <span>${pct.toFixed(0)}%</span>
                </div>
                <div class="fuel-bar-track">
                    <div class="fuel-bar-fill ${cls}" style="width:${pct}%"></div>
                </div>
            </div>
        `;
    }

    renderVehicles() {
        const container = document.getElementById('vehicleList');
        if (!container) return;
        const live = window.__qproOperationsSnapshot;
        const liveHtml = live ? this.liveSimulationFleetHTML(live) : '';

        if (this.vehicles.length === 0) {
            container.innerHTML = `${liveHtml}<p class="info-text">No vehicles registered. Click "+ Add Vehicle" to get started.</p>`;
            return;
        }

        container.innerHTML = liveHtml + this.vehicles.map(v => {
            const alerts = [];
            if (v.fuel_alert) alerts.push(`<span class="alert-badge danger">⛽ Low Fuel</span>`);
            if (v.maintenance_due) alerts.push(`<span class="alert-badge warn">🔧 Service Due</span>`);

            return `
            <div class="vehicle-card" data-vehicle-id="${v.id}">
                <div class="vehicle-header">
                    <div>
                        <div class="vehicle-name">${v.name}</div>
                        <div class="vehicle-type">${this.typeLabel(v.type)}</div>
                    </div>
                    <span class="vehicle-status ${v.status}">${v.status}</span>
                </div>
                <div class="vehicle-info">
                    <div>Capacity: <strong>${v.capacity ? v.capacity + 't' : '—'}</strong></div>
                    <div>Hours: <strong>${parseFloat(v.hours).toFixed(1)}h</strong></div>
                    <div>Zone: <strong>${v.zone || 'Unassigned'}</strong></div>
                    <div>Next service: <strong>${v.hours_to_service}h</strong></div>
                </div>
                ${this.fuelBarHTML(v.fuel_level)}
                ${alerts.length > 0 ? `<div class="vehicle-alerts">${alerts.join('')}</div>` : ''}
                ${v.notes ? `<div class="vehicle-notes">${v.notes}</div>` : ''}
                <div class="vehicle-actions" style="margin-top:10px;">
                    <select class="status-select" data-vehicle-id="${v.id}">
                        <option value="working" ${v.status === 'working' ? 'selected' : ''}>Working</option>
                        <option value="idle" ${v.status === 'idle' ? 'selected' : ''}>Idle</option>
                        <option value="maintenance" ${v.status === 'maintenance' ? 'selected' : ''}>Maintenance</option>
                        <option value="breakdown" ${v.status === 'breakdown' ? 'selected' : ''}>Breakdown</option>
                        <option value="fuelling" ${v.status === 'fuelling' ? 'selected' : ''}>Fuelling</option>
                    </select>
                    <button class="btn-secondary refuel-vehicle" data-vehicle-id="${v.id}" title="Log refuel">⛽</button>
                    <button class="btn-secondary edit-vehicle" data-vehicle-id="${v.id}" title="Edit">✏️</button>
                    <button class="btn-secondary delete-vehicle" data-vehicle-id="${v.id}" title="Delete">🗑️</button>
                    <button class="btn-deploy" data-vehicle-id="${v.id}" title="Deploy to live map">📍 Deploy</button>
                </div>
            </div>`;
        }).join('');

        // Event listeners
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateVehicleStatus(e.target.dataset.vehicleId, e.target.value);
            });
        });

        document.querySelectorAll('.edit-vehicle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.vehicleId;
                const vehicle = this.vehicles.find(v => v.id == id);
                if (vehicle) this.showEditModal(vehicle);
            });
        });

        document.querySelectorAll('.delete-vehicle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.vehicleId;
                const vehicle = this.vehicles.find(v => v.id == id);
                if (confirm(`Delete ${vehicle ? vehicle.name : 'this vehicle'}?`)) {
                    this.deleteVehicle(id);
                }
            });
        });

        document.querySelectorAll('.btn-deploy').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.vehicleId;
                const vehicle = this.vehicles.find(v => v.id == id);
                if (vehicle && typeof quarryMap !== 'undefined') {
                    quarryMap.beginDeploy({ id: vehicle.id, name: vehicle.name, type: vehicle.type });
                }
            });
        });

        document.querySelectorAll('.refuel-vehicle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.vehicleId;
                const vehicle = this.vehicles.find(v => v.id == id);
                if (vehicle) this.showRefuelModal(vehicle);
            });
        });
    }

    applySimulationSnapshot(snapshot) {
        if (!snapshot) return;
        if (document.getElementById('vehicleList')) this.renderVehicles();
    }

    liveSimulationFleetHTML(snapshot) {
        const equipment = snapshot.activeEquipment || [];
        if (!equipment.length) return '';
        return `
            <div class="vehicle-card" style="border-color:#58a6ff;">
                <div class="vehicle-header">
                    <div>
                        <div class="vehicle-name">Live Quarry Fleet</div>
                        <div class="vehicle-type">Simulation-linked equipment</div>
                    </div>
                    <span class="vehicle-status working">live</span>
                </div>
                <div class="vehicle-info">
                    <div>Dumpers: <strong>${snapshot.equipmentCounts.dumper || 0}</strong></div>
                    <div>Excavators: <strong>${snapshot.equipmentCounts.excavator || 0}</strong></div>
                    <div>Loaders: <strong>${snapshot.equipmentCounts.loader || 0}</strong></div>
                    <div>Plant: <strong>${snapshot.equipmentCounts.crusher || 0}/${snapshot.equipmentCounts.screener || 0}</strong></div>
                </div>
                <div class="vehicle-notes">${equipment.map(eq => `${this.typeLabel(eq.type)}: ${eq.state}`).slice(0, 6).join(' · ')}</div>
            </div>`;
    }

    typeLabel(type) {
        const map = {
            dumper: '🚛 Dumper Truck', dump_truck: '🚛 Dumper Truck',
            excavator: '🦾 Excavator', loader: '🔄 Loader',
            dozer: '🚜 Dozer', crusher: '⚙️ Crusher',
            screener: '📡 Screener', grader: '🛣️ Grader'
        };
        return map[type] || type;
    }

    setupEventListeners() {
        const addBtn = document.getElementById('addVehicle');
        if (addBtn) addBtn.addEventListener('click', () => this.showAddVehicleModal());
    }

    showAddVehicleModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Add Vehicle';
        document.getElementById('modalBody').innerHTML = `
            <form id="addVehicleForm">
                <div class="form-group">
                    <label>Vehicle Name</label>
                    <input type="text" name="name" required placeholder="e.g. Dumper 01">
                </div>
                <div class="form-group">
                    <label>Type</label>
                    <select name="type" required>
                        <option value="dumper">Dumper Truck</option>
                        <option value="excavator">Excavator</option>
                        <option value="loader">Loader</option>
                        <option value="dozer">Dozer</option>
                        <option value="crusher">Crusher</option>
                        <option value="screener">Screener</option>
                        <option value="grader">Grader</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Capacity (tonnes)</label>
                    <input type="number" name="capacity" step="0.1" placeholder="e.g. 30">
                </div>
                <div class="form-group">
                    <label>Current Hours</label>
                    <input type="number" name="hours" step="0.1" placeholder="e.g. 1250" value="0">
                </div>
                <div class="form-group">
                    <label>Service Interval (hours)</label>
                    <input type="number" name="service_interval_hours" step="50" placeholder="e.g. 500" value="500">
                </div>
                <div class="form-group">
                    <label>Zone / Area</label>
                    <input type="text" name="zone" placeholder="e.g. Face A, Crusher, Stockpile">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <input type="text" name="notes" placeholder="e.g. Komatsu HD785-7, reg YJ21 ABC">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Add Vehicle</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('addVehicleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            await this.addVehicle(data);
            modal.style.display = 'none';
        });
    }

    showEditModal(vehicle) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = `Edit — ${vehicle.name}`;
        document.getElementById('modalBody').innerHTML = `
            <form id="editVehicleForm">
                <div class="form-group">
                    <label>Fuel Level (%)</label>
                    <input type="number" name="fuel_level" min="0" max="100" value="${vehicle.fuel_level.toFixed(0)}">
                </div>
                <div class="form-group">
                    <label>Hours on Clock</label>
                    <input type="number" name="hours" step="0.1" value="${parseFloat(vehicle.hours).toFixed(1)}">
                </div>
                <div class="form-group">
                    <label>Last Service At (hours)</label>
                    <input type="number" name="last_service_hours" step="0.1" value="${parseFloat(vehicle.last_service_hours).toFixed(1)}">
                </div>
                <div class="form-group">
                    <label>Service Interval (hours)</label>
                    <input type="number" name="service_interval_hours" step="50" value="${vehicle.service_interval_hours}">
                </div>
                <div class="form-group">
                    <label>Zone / Area</label>
                    <input type="text" name="zone" value="${vehicle.zone || ''}">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <input type="text" name="notes" value="${vehicle.notes || ''}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Save Changes</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('editVehicleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            await fetch(`api/vehicles/${vehicle.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            modal.style.display = 'none';
            await this.refresh();
            if (window.maintenanceManager) maintenanceManager.refresh();
            window.toast && window.toast(`✏️ ${vehicle.name} updated`, 'info');
        });
    }

    async addVehicle(data) {
        try {
            const response = await fetch('api/vehicles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const vehicle = await response.json();
            this.vehicles.push(vehicle);
            this.renderVehicles();
            if (window.map3d) map3d.addVehicleMarker(vehicle.id, vehicle.name, vehicle.type);
            window.toast && window.toast(`🚛 ${vehicle.name} added to fleet`, 'success');
        } catch (error) {
            console.error('Failed to add vehicle:', error);
            window.toast && window.toast('Failed to add vehicle', 'error');
        }
    }

    async updateVehicleStatus(id, status) {
        try {
            await fetch(`api/vehicles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const vehicle = this.vehicles.find(v => v.id == id);
            if (vehicle) vehicle.status = status;
            if (window.map3d) map3d.updateVehicleMarker(id, status);
            if (window.kpiManager) kpiManager.refresh();
        } catch (error) {
            console.error('Failed to update vehicle:', error);
        }
    }

    async deleteVehicle(id) {
        try {
            const veh = this.vehicles.find(v => v.id == id);
            await fetch(`api/vehicles/${id}`, { method: 'DELETE' });
            this.vehicles = this.vehicles.filter(v => v.id != id);
            this.renderVehicles();
            if (window.map3d) map3d.removeVehicleMarker(id);
            window.toast && window.toast(`🗑️ ${veh ? veh.name : 'Vehicle'} removed from fleet`, 'warn');
        } catch (error) {
            console.error('Failed to delete vehicle:', error);
        }
    }

    showRefuelModal(vehicle) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = `⛽ Refuel — ${vehicle.name}`;
        document.getElementById('modalBody').innerHTML = `
            <p style="color:var(--text-secondary);margin-bottom:16px;">
                Current fuel: <strong>${parseFloat(vehicle.fuel_level).toFixed(0)}%</strong>
                &nbsp;·&nbsp; Hours: <strong>${parseFloat(vehicle.hours).toFixed(1)}h</strong>
            </p>
            <div class="form-grid">
                <div class="form-group">
                    <label>Litres Added *</label>
                    <input type="number" id="refuel-litres" class="input" step="1" min="1" placeholder="e.g. 200" autofocus>
                </div>
                <div class="form-group">
                    <label>Cost per Litre (£)</label>
                    <input type="number" id="refuel-cpl" class="input" step="0.001" value="1.200" placeholder="1.20">
                </div>
                <div class="form-group">
                    <label>Refuelled By</label>
                    <input type="text" id="refuel-by" class="input" placeholder="Name">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <input type="text" id="refuel-notes" class="input" placeholder="Optional">
                </div>
            </div>
            <div class="refuel-preview" id="refuel-preview"></div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none'">Cancel</button>
                <button class="btn-primary" id="submitRefuel">Log Refuel</button>
            </div>
        `;
        modal.style.display = 'flex';

        // Live cost preview
        const litresEl = document.getElementById('refuel-litres');
        const cplEl = document.getElementById('refuel-cpl');
        const preview = document.getElementById('refuel-preview');

        const updatePreview = () => {
            const litres = parseFloat(litresEl.value) || 0;
            const cpl = parseFloat(cplEl.value) || 1.2;
            if (litres > 0) {
                const totalCost = (litres * cpl).toFixed(2);
                const TANK = 400;
                const litresBefore = (parseFloat(vehicle.fuel_level) / 100) * TANK;
                const after = Math.min(100, ((litresBefore + litres) / TANK) * 100).toFixed(0);
                preview.innerHTML = `
                    <div class="refuel-preview-line">
                        <span>Total cost:</span><strong>£${totalCost}</strong>
                    </div>
                    <div class="refuel-preview-line">
                        <span>Fuel after:</span><strong>${after}%</strong>
                    </div>
                `;
            } else {
                preview.innerHTML = '';
            }
        };
        litresEl.addEventListener('input', updatePreview);
        cplEl.addEventListener('input', updatePreview);

        const submit = async () => {
            const litres = parseFloat(litresEl.value);
            if (!litres || litres <= 0) {
                window.toast('Enter litres added', 'warn');
                return;
            }
            const payload = {
                vehicle_id: vehicle.id,
                litres,
                cost_per_litre: parseFloat(cplEl.value) || 1.2,
                refuelled_by: document.getElementById('refuel-by').value.trim() || null,
                notes: document.getElementById('refuel-notes').value.trim() || null,
            };
            try {
                const res = await fetch('api/fuel-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                modal.style.display = 'none';
                await this.refresh();
                window.toast(`⛽ ${vehicle.name} refuelled — £${(litres * (parseFloat(cplEl.value) || 1.2)).toFixed(2)} · ${data.fuel_level_after?.toFixed(0)}% full`, 'success', 5000);
            } catch (e) {
                window.toast('Failed to log refuel', 'error');
            }
        };

        document.getElementById('submitRefuel').addEventListener('click', submit);
        litresEl.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    }
}

let fleetManager;
document.addEventListener('DOMContentLoaded', () => {
    fleetManager = new FleetManager();
});
