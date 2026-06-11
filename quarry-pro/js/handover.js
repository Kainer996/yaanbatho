// QuarryPro - Shift Handover v2.2

class HandoverManager {
    constructor() {
        this.handovers = [];
        this.preparedData = null;
        this.init();
    }

    async init() {
        await this.loadHandovers();
        this.renderHandovers();
        this.setupEventListeners();
    }

    async loadHandovers() {
        try {
            const res = await fetch('api/handovers?limit=10');
            this.handovers = await res.json();
        } catch (e) {
            console.error('Failed to load handovers:', e);
        }
    }

    async loadPreparedData() {
        try {
            const res = await fetch('api/handovers/prepare');
            this.preparedData = await res.json();
        } catch (e) {
            console.error('Failed to load handover prep data:', e);
        }
        return this.preparedData;
    }

    renderHandovers() {
        const container = document.getElementById('handoverList');
        if (!container) return;

        if (this.handovers.length === 0) {
            container.innerHTML = '<p class="info-text">No shift handovers recorded yet. Start a new handover to log end-of-shift details.</p>';
            return;
        }

        container.innerHTML = this.handovers.map(h => {
            const date = new Date(h.created_at);
            const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const shiftColour = h.shift === 'day' ? 'var(--accent-yellow)' : h.shift === 'night' ? 'var(--accent-blue)' : 'var(--accent-green)';

            let vehicleRows = '';
            if (h.vehicle_snapshot) {
                try {
                    const snap = JSON.parse(h.vehicle_snapshot);
                    vehicleRows = snap.map(v => `
                        <div class="handover-vehicle-row">
                            <span class="vehicle-status ${v.status}" style="font-size:10px;padding:2px 6px;">${v.status}</span>
                            <span style="font-size:12px;">${v.name}</span>
                            <span style="font-size:11px;color:var(--text-tertiary);">${v.zone || '—'}</span>
                            <span style="font-size:11px;color:${v.fuel_level < 25 ? 'var(--accent-red)' : 'var(--text-tertiary)'};">⛽ ${parseFloat(v.fuel_level).toFixed(0)}%</span>
                        </div>`).join('');
                } catch (_) {}
            }

            return `
            <div class="handover-card">
                <div class="handover-card-header">
                    <div>
                        <span class="handover-shift-badge" style="background:${shiftColour}22;color:${shiftColour};border-color:${shiftColour}44;">
                            ${this.shiftLabel(h.shift)} Shift
                        </span>
                        <span class="handover-date">${dateStr} — ${timeStr}</span>
                    </div>
                    <div class="handover-meta-stats">
                        <span>📦 ${parseFloat(h.total_tonnes).toFixed(1)}t</span>
                        <span>🚛 ${h.total_loads} loads</span>
                        ${h.incident_count > 0 ? `<span style="color:var(--accent-red)">⚠️ ${h.incident_count} incident${h.incident_count > 1 ? 's' : ''}</span>` : '<span style="color:var(--accent-green)">✅ No incidents</span>'}
                    </div>
                </div>

                <div class="handover-people">
                    <span>👤 Outgoing: <strong>${h.outgoing_supervisor || '—'}</strong></span>
                    <span>👤 Incoming: <strong>${h.incoming_supervisor || '—'}</strong></span>
                </div>

                ${h.open_issues ? `
                <div class="handover-section">
                    <div class="handover-section-label">⚠️ Open Issues</div>
                    <div class="handover-body-text">${h.open_issues}</div>
                </div>` : ''}

                ${h.notes ? `
                <div class="handover-section">
                    <div class="handover-section-label">📋 Handover Notes</div>
                    <div class="handover-body-text">${h.notes}</div>
                </div>` : ''}

                ${h.fuel_status ? `
                <div class="handover-section">
                    <div class="handover-section-label">⛽ Fuel / Consumables</div>
                    <div class="handover-body-text">${h.fuel_status}</div>
                </div>` : ''}

                ${vehicleRows ? `
                <div class="handover-section">
                    <div class="handover-section-label">🚛 Vehicle Snapshot at Handover</div>
                    <div class="handover-vehicle-grid">${vehicleRows}</div>
                </div>` : ''}
            </div>`;
        }).join('');
    }

    shiftLabel(shift) {
        return shift === 'day' ? '☀️ Day' : shift === 'night' ? '🌙 Night' : shift === 'afternoon' ? '🌆 Afternoon' : shift || 'Unknown';
    }

    setupEventListeners() {
        const btn = document.getElementById('newHandover');
        if (btn) btn.addEventListener('click', () => this.showHandoverModal());
    }

    async showHandoverModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'New Shift Handover';

        // Show loading state
        document.getElementById('modalBody').innerHTML = `<p class="info-text">Loading shift data...</p>`;
        modal.style.display = 'block';

        const data = await this.loadPreparedData();
        if (!data) {
            document.getElementById('modalBody').innerHTML = `<p style="color:var(--accent-red)">Failed to load shift data.</p>`;
            return;
        }

        // Determine current shift label
        const hour = new Date().getHours();
        const autoShift = hour >= 6 && hour < 14 ? 'day' : hour >= 14 && hour < 22 ? 'afternoon' : 'night';

        const vehicleStatusRows = data.vehicles.map(v => `
            <div class="handover-vehicle-row" style="padding:4px 0;border-bottom:1px solid var(--border-color);">
                <span class="vehicle-status ${v.status}" style="font-size:10px;padding:1px 5px;">${v.status}</span>
                <span style="font-size:12px;flex:1;">${v.name}</span>
                <span style="font-size:11px;color:${v.fuel_level < 25 ? 'var(--accent-red)' : 'var(--text-tertiary)'};">⛽ ${parseFloat(v.fuel_level).toFixed(0)}%</span>
            </div>`).join('');

        const materialSummary = data.materialBreakdown.map(m =>
            `${m.material_type}: ${parseFloat(m.tonnes).toFixed(0)}t`
        ).join(', ') || 'No production logged';

        document.getElementById('modalBody').innerHTML = `
            <form id="handoverForm">
                <div style="background:var(--bg-tertiary);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;">
                    <strong style="color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Today's Shift Summary</strong>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px;">
                        <div class="stat-card" style="padding:10px;text-align:center;">
                            <div style="font-size:22px;font-weight:700;color:var(--accent-blue);">${parseFloat(data.production.total_tonnes).toFixed(1)}</div>
                            <div style="font-size:11px;color:var(--text-tertiary);">Tonnes</div>
                        </div>
                        <div class="stat-card" style="padding:10px;text-align:center;">
                            <div style="font-size:22px;font-weight:700;color:var(--accent-blue);">${data.production.total_loads}</div>
                            <div style="font-size:11px;color:var(--text-tertiary);">Loads</div>
                        </div>
                        <div class="stat-card" style="padding:10px;text-align:center;">
                            <div style="font-size:22px;font-weight:700;color:${data.incidents > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">${data.incidents}</div>
                            <div style="font-size:11px;color:var(--text-tertiary);">Incidents</div>
                        </div>
                    </div>
                    <div style="margin-top:8px;font-size:12px;color:var(--text-tertiary);">Materials: ${materialSummary}</div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group" style="margin-bottom:0">
                        <label>Shift</label>
                        <select name="shift">
                            <option value="day" ${autoShift === 'day' ? 'selected' : ''}>☀️ Day Shift</option>
                            <option value="afternoon" ${autoShift === 'afternoon' ? 'selected' : ''}>🌆 Afternoon Shift</option>
                            <option value="night" ${autoShift === 'night' ? 'selected' : ''}>🌙 Night Shift</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label>Outgoing Supervisor</label>
                        <input type="text" name="outgoing_supervisor" placeholder="Your name">
                    </div>
                </div>
                <div class="form-group" style="margin-top:12px;">
                    <label>Incoming Supervisor</label>
                    <input type="text" name="incoming_supervisor" placeholder="Name of person taking over">
                </div>

                <div class="form-group">
                    <label>⚠️ Open Issues / Work to Watch</label>
                    <textarea name="open_issues" class="input" rows="3" style="width:100%;resize:vertical;font-family:inherit;" placeholder="e.g. Face A has soft ground — keep to designated track. Crusher blocked at 14:00, now clear."></textarea>
                </div>

                <div class="form-group">
                    <label>⛽ Fuel / Consumables Status</label>
                    <textarea name="fuel_status" class="input" rows="2" style="width:100%;resize:vertical;font-family:inherit;" placeholder="e.g. Dumper 3 needs fuel first thing. Hydraulic oil low on Excavator 2 — ordered."></textarea>
                </div>

                <div class="form-group">
                    <label>📋 Additional Handover Notes</label>
                    <textarea name="notes" class="input" rows="3" style="width:100%;resize:vertical;font-family:inherit;" placeholder="Any other info for the incoming shift..."></textarea>
                </div>

                ${data.vehicles.length > 0 ? `
                <div class="form-group">
                    <label>🚛 Fleet Status at Handover</label>
                    <div style="max-height:140px;overflow-y:auto;background:var(--bg-tertiary);border-radius:6px;padding:8px;border:1px solid var(--border-color);">
                        ${vehicleStatusRows}
                    </div>
                </div>` : ''}

                <input type="hidden" name="total_tonnes" value="${data.production.total_tonnes}">
                <input type="hidden" name="total_loads" value="${data.production.total_loads}">
                <input type="hidden" name="incident_count" value="${data.incidents}">
                <input type="hidden" name="vehicle_snapshot_json" value='${JSON.stringify(data.vehicles)}'>

                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Save Handover</button>
                </div>
            </form>`;

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('handoverForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = {
                shift: fd.get('shift'),
                outgoing_supervisor: fd.get('outgoing_supervisor'),
                incoming_supervisor: fd.get('incoming_supervisor'),
                open_issues: fd.get('open_issues'),
                fuel_status: fd.get('fuel_status'),
                notes: fd.get('notes'),
                total_tonnes: parseFloat(fd.get('total_tonnes')) || 0,
                total_loads: parseInt(fd.get('total_loads')) || 0,
                incident_count: parseInt(fd.get('incident_count')) || 0,
                vehicle_snapshot: JSON.parse(fd.get('vehicle_snapshot_json') || '[]')
            };
            await this.saveHandover(payload);
            modal.style.display = 'none';
        });
    }

    async saveHandover(payload) {
        try {
            await fetch('api/handovers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await this.loadHandovers();
            this.renderHandovers();
        } catch (e) {
            console.error('Failed to save handover:', e);
            alert('Failed to save handover');
        }
    }

    async refresh() {
        await this.loadHandovers();
        this.renderHandovers();
    }
}

let handoverManager;
document.addEventListener('DOMContentLoaded', () => {
    handoverManager = new HandoverManager();
});
