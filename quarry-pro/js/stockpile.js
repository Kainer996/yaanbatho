// QuarryPro - Stockpile Tracker v2.2

class StockpileManager {
    constructor() {
        this.stockpiles = [];
        this.init();
        setInterval(() => this.refresh(), 60000);
    }

    async init() {
        await this.loadStockpiles();
        this.render();
        this.setupEventListeners();
    }

    async loadStockpiles() {
        try {
            const res = await fetch('api/stockpiles');
            this.stockpiles = await res.json();
        } catch (e) {
            console.error('Failed to load stockpiles:', e);
        }
    }

    async refresh() {
        await this.loadStockpiles();
        this.render();
    }

    levelColour(pct, alertLow, alertFull) {
        if (alertFull) return 'var(--accent-yellow)';
        if (alertLow)  return 'var(--accent-red)';
        if (pct > 75)  return 'var(--accent-green)';
        if (pct > 40)  return 'var(--accent-blue)';
        return 'var(--accent-yellow)';
    }

    render() {
        const container = document.getElementById('stockpileList');
        if (!container) return;

        if (this.stockpiles.length === 0) {
            container.innerHTML = '<p class="info-text">No stockpiles configured. Click "+ Add Stockpile" to add one.</p>';
            return;
        }

        // Summary row
        const alerts = this.stockpiles.filter(s => s.alert_low || s.alert_full);
        const summaryHtml = alerts.length > 0
            ? `<div class="stockpile-alerts">
                ${alerts.map(s => `
                    <div class="alert-item ${s.alert_low ? 'red' : 'yellow'}">
                        <span>${s.alert_low ? '⚠️ LOW STOCK' : '⚠️ NEAR FULL'}: <strong>${s.material}</strong></span>
                        <span>${parseFloat(s.current_tonnes).toFixed(0)}t / ${parseFloat(s.max_tonnes).toFixed(0)}t</span>
                    </div>`).join('')}
               </div>`
            : '';

        const cards = this.stockpiles.map(s => {
            const pct = Math.min(100, parseFloat(s.pct_full) || 0);
            const colour = this.levelColour(pct, s.alert_low, s.alert_full);
            const lastUpdate = new Date(s.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const lastUpdateDate = new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

            return `
            <div class="stockpile-card ${s.alert_low ? 'alert-low' : s.alert_full ? 'alert-full' : ''}">
                <div class="stockpile-header">
                    <div>
                        <div class="stockpile-name">${s.material}</div>
                        <div class="stockpile-location">${s.location || '—'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="stockpile-tonnes" style="color:${colour};">${parseFloat(s.current_tonnes).toFixed(0)}t</div>
                        <div style="font-size:11px;color:var(--text-tertiary);">of ${parseFloat(s.max_tonnes).toFixed(0)}t</div>
                    </div>
                </div>
                <div class="stockpile-bar-wrap">
                    <div class="stockpile-bar-track">
                        <div class="stockpile-bar-fill" style="width:${pct}%;background:${colour};"></div>
                        ${s.min_alert_tonnes > 0 ? `<div class="stockpile-bar-marker low" style="left:${(s.min_alert_tonnes/s.max_tonnes*100).toFixed(1)}%" title="Low alert: ${s.min_alert_tonnes}t"></div>` : ''}
                        ${s.full_alert_tonnes < s.max_tonnes ? `<div class="stockpile-bar-marker full" style="left:${(s.full_alert_tonnes/s.max_tonnes*100).toFixed(1)}%" title="Full alert: ${s.full_alert_tonnes}t"></div>` : ''}
                    </div>
                    <div class="stockpile-bar-labels">
                        <span>Empty</span>
                        <span style="color:${colour};font-weight:600;">${pct.toFixed(0)}%</span>
                        <span>Full</span>
                    </div>
                </div>
                <div class="stockpile-footer">
                    <span style="font-size:11px;color:var(--text-tertiary);">Updated ${lastUpdateDate} ${lastUpdate}</span>
                    <div style="display:flex;gap:6px;">
                        <button class="btn-secondary adjust-stockpile" data-sp-id="${s.id}" data-material="${s.material}" data-current="${s.current_tonnes}" data-max="${s.max_tonnes}" style="padding:3px 8px;font-size:12px;">Update Level</button>
                        <button class="btn-secondary delete-stockpile" data-sp-id="${s.id}" style="padding:3px 8px;font-size:12px;color:var(--accent-red);">🗑</button>
                    </div>
                </div>
                ${s.alert_low ? '<div class="stockpile-alert-tag red">⚠️ Stock Low — action required</div>' : ''}
                ${s.alert_full ? '<div class="stockpile-alert-tag yellow">⚠️ Near Capacity — arrange dispatch</div>' : ''}
            </div>`;
        }).join('');

        container.innerHTML = summaryHtml + `<div class="stockpile-grid">${cards}</div>`;

        document.querySelectorAll('.adjust-stockpile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { spId, material, current, max } = e.target.dataset;
                this.showAdjustModal(spId, material, current, max);
            });
        });

        document.querySelectorAll('.delete-stockpile').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.spId;
                if (confirm('Remove this stockpile?')) {
                    await fetch(`api/stockpiles/${id}`, { method: 'DELETE' });
                    await this.refresh();
                }
            });
        });
    }

    showAdjustModal(id, material, currentTonnes, maxTonnes) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = `Update Stockpile — ${material}`;
        document.getElementById('modalBody').innerHTML = `
            <form id="adjustStockpileForm">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">
                    Current level: <strong>${parseFloat(currentTonnes).toFixed(0)}t</strong> of ${parseFloat(maxTonnes).toFixed(0)}t
                </p>
                <div class="form-group">
                    <label>Set Level to (tonnes)</label>
                    <input type="number" name="current_tonnes" step="1" min="0" value="${parseFloat(currentTonnes).toFixed(0)}" required>
                </div>
                <div class="form-group">
                    <label>Adjustment Reason (optional)</label>
                    <input type="text" name="reason" placeholder="e.g. Survey update, stockpile measured, truck count">
                </div>
                <div class="form-group">
                    <label>Max Capacity (tonnes)</label>
                    <input type="number" name="max_tonnes" step="100" value="${parseFloat(maxTonnes).toFixed(0)}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Save</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('adjustStockpileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await fetch(`api/stockpiles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_tonnes: parseFloat(fd.get('current_tonnes')),
                    max_tonnes: parseFloat(fd.get('max_tonnes'))
                })
            });
            modal.style.display = 'none';
            await this.refresh();
        });
    }

    showAddStockpileModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Add Stockpile';
        document.getElementById('modalBody').innerHTML = `
            <form id="addStockpileForm">
                <div class="form-group">
                    <label>Material</label>
                    <select name="material">
                        <option value="Limestone RoQ">Limestone (Run of Quarry)</option>
                        <option value="6mm">6mm</option>
                        <option value="10mm">10mm</option>
                        <option value="14mm">14mm</option>
                        <option value="20mm">20mm</option>
                        <option value="40mm">40mm</option>
                        <option value="Dust / Fines">Dust / Fines</option>
                        <option value="Oversize">Oversize</option>
                        <option value="Crushed Rock">Crushed Rock</option>
                        <option value="Recycled">Recycled</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Location / Bay</label>
                    <input type="text" name="location" placeholder="e.g. Screen Products Bay, South Stockpile">
                </div>
                <div class="form-group">
                    <label>Current Level (tonnes)</label>
                    <input type="number" name="current_tonnes" step="1" min="0" value="0" required>
                </div>
                <div class="form-group">
                    <label>Maximum Capacity (tonnes)</label>
                    <input type="number" name="max_tonnes" step="100" min="100" value="5000" required>
                </div>
                <div class="form-group">
                    <label>Low Stock Alert Below (tonnes)</label>
                    <input type="number" name="min_alert_tonnes" step="50" min="0" value="500">
                </div>
                <div class="form-group">
                    <label>Near Full Alert Above (tonnes)</label>
                    <input type="number" name="full_alert_tonnes" step="100" value="4500">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Add Stockpile</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('addStockpileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await fetch('api/stockpiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(fd))
            });
            modal.style.display = 'none';
            await this.refresh();
        });
    }

    setupEventListeners() {
        const btn = document.getElementById('addStockpile');
        if (btn) btn.addEventListener('click', () => this.showAddStockpileModal());
    }
}

let stockpileManager;
document.addEventListener('DOMContentLoaded', () => {
    stockpileManager = new StockpileManager();
});
