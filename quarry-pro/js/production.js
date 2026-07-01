// QuarryPro - Production Tracking v2.0

class ProductionManager {
    constructor() {
        this.logs = [];
        this.chart = null;
        this.init();
        window.addEventListener('qpro:simulation-snapshot', (event) => this.applySimulationSnapshot(event.detail));
    }

    async init() {
        await this.loadLogs();
        await this.renderStats();
        this.renderLogs();
        this.setupChart();
        this.setupEventListeners();
    }

    async loadLogs() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`api/production?date=${today}`);
            this.logs = await response.json();
        } catch (error) {
            console.error('Failed to load production logs:', error);
        }
    }

    async renderStats() {
        try {
            const response = await fetch('api/kpis/today');
            const kpis = await response.json();

            document.getElementById('todayTonnes').textContent = `${parseFloat(kpis.total_tonnes).toFixed(1)} t`;
            document.getElementById('todayLoads').textContent = kpis.load_count;
            document.getElementById('tonnesPerHour').textContent = `${kpis.tonnes_per_hour} t/h`;

            // Target progress
            const targetBar = document.getElementById('prod-target-bar');
            const targetLabel = document.getElementById('prod-target-label');
            if (targetBar && targetLabel) {
                const pct = parseFloat(kpis.target_pct);
                targetBar.style.width = `${Math.min(100, pct)}%`;
                if (pct >= 100) targetBar.classList.add('over');
                targetLabel.textContent = `${parseFloat(kpis.total_tonnes).toFixed(0)} / ${kpis.daily_target} t`;
            }

            // Material chips
            const chipsEl = document.getElementById('material-chips');
            if (chipsEl && kpis.materials && kpis.materials.length > 0) {
                chipsEl.innerHTML = kpis.materials.map(m => `
                    <div class="material-chip">
                        <strong>${parseFloat(m.tonnes).toFixed(0)}t</strong> ${m.material_type || 'unknown'} (${m.loads} loads)
                    </div>
                `).join('');
            } else if (chipsEl) {
                chipsEl.innerHTML = '';
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    applySimulationSnapshot(snapshot) {
        if (!snapshot) return;
        const targetPct = snapshot.dailyTarget > 0 ? Math.min(100, (snapshot.tonnesToday / snapshot.dailyTarget) * 100) : 0;
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText('todayTonnes', `${snapshot.tonnesToday.toFixed(1)} t`);
        setText('todayLoads', snapshot.cycles.crusherScreener);
        setText('tonnesPerHour', `${Math.round(snapshot.material.localSellableProduct)} t stock`);
        setText('prod-target-label', `${snapshot.tonnesToday.toFixed(0)} / ${snapshot.dailyTarget} t`);
        const targetBar = document.getElementById('prod-target-bar');
        if (targetBar) targetBar.style.width = `${targetPct}%`;
        const chipsEl = document.getElementById('material-chips');
        if (chipsEl) {
            chipsEl.innerHTML = `
                <div class="material-chip"><strong>${Math.round(snapshot.material.looseGround)}t</strong> shot rock</div>
                <div class="material-chip"><strong>${Math.round(snapshot.material.screenerLocalProduct)}t</strong> product bay</div>
                <div class="material-chip"><strong>${Math.round(snapshot.material.edgeStockpiles)}t</strong> edge piles</div>
                <div class="material-chip"><strong>${Math.round(snapshot.dust.index)}</strong> dust index</div>
                <div class="material-chip"><strong>${snapshot.water.risk}</strong> water table</div>
            `;
        }
    }

    renderLogs() {
        const container = document.getElementById('productionLog');
        if (!container) return;

        if (this.logs.length === 0) {
            container.innerHTML = '<p class="info-text">No production logged yet today.</p>';
            return;
        }

        const materialColors = {
            limestone: '#8a8070', '6mm': '#2f81f7', '10mm': '#1f6feb',
            '14mm': '#3fb950', '20mm': '#d29922', '40mm': '#f85149',
            dust: '#8b949e'
        };

        container.innerHTML = this.logs.slice(0, 30).map(log => {
            const ts = new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const matColor = materialColors[log.material_type] || '#6e7681';
            return `
                <div class="log-item" style="border-left:3px solid ${matColor};padding-left:10px;">
                    <div>
                        <strong>${log.vehicle_name || 'Unknown'}</strong>
                        — ${parseFloat(log.tonnes).toFixed(1)}t
                        <span style="color:var(--text-tertiary);font-size:12px;margin-left:4px;">${log.material_type || ''}</span>
                        ${log.zone ? `<span style="color:var(--text-tertiary);font-size:12px;"> @ ${log.zone}</span>` : ''}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="color:var(--text-tertiary);font-size:12px;">${ts}</span>
                        <button class="btn-secondary delete-log" data-log-id="${log.id}" style="padding:2px 6px;font-size:11px;" title="Delete">✕</button>
                    </div>
                </div>`;
        }).join('');

        document.querySelectorAll('.delete-log').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.logId;
                if (confirm('Remove this log entry?')) {
                    await fetch(`api/production/${id}`, { method: 'DELETE' });
                    await this.loadLogs();
                    await this.renderStats();
                    this.renderLogs();
                    this.updateChart();
                    if (window.kpiManager) kpiManager.refresh();
                }
            });
        });
    }

    async setupChart() {
        const ctx = document.getElementById('productionChart').getContext('2d');
        const hourlyData = await this.getHourlyProduction();

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourlyData.labels,
                datasets: [{
                    label: 'Tonnes',
                    data: hourlyData.values,
                    backgroundColor: hourlyData.values.map((v, i) => i === hourlyData.currentHourIdx ? '#3fb950' : '#2f81f7'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y.toFixed(1)} t`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#30363d' },
                        ticks: { color: '#8b949e', callback: v => v + 't' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8b949e' }
                    }
                }
            }
        });
    }

    async getHourlyProduction() {
        // Fetch from server API (includes only hours with data + context)
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`api/production/hourly?date=${today}`);
            const rows = await response.json();

            // Show shift hours: from shift start (6am) to current hour
            const shiftStart = window._shiftStartHour || 6;
            const currentHour = new Date().getHours();
            const labels = [];
            const values = [];
            let currentHourIdx = -1;

            for (let h = shiftStart; h <= Math.max(currentHour, shiftStart + 1); h++) {
                const hStr = String(h).padStart(2, '0');
                labels.push(`${hStr}:00`);
                const row = rows.find(r => r.hour === hStr);
                values.push(row ? parseFloat(row.tonnes) : 0);
                if (h === currentHour) currentHourIdx = labels.length - 1;
            }

            return { labels, values, currentHourIdx };
        } catch {
            return { labels: [], values: [], currentHourIdx: -1 };
        }
    }

    async updateChart() {
        if (!this.chart) return;
        const hourlyData = await this.getHourlyProduction();
        this.chart.data.labels = hourlyData.labels;
        this.chart.data.datasets[0].data = hourlyData.values;
        this.chart.data.datasets[0].backgroundColor = hourlyData.values.map((v, i) =>
            i === hourlyData.currentHourIdx ? '#3fb950' : '#2f81f7'
        );
        this.chart.update();
    }

    setupEventListeners() {
        const btn = document.getElementById('logProduction');
        if (btn) btn.addEventListener('click', () => this.showLogModal());
        const wbBtn = document.getElementById('logWeighbridge');
        if (wbBtn) wbBtn.addEventListener('click', () => this.showWeighbridgeModal());
    }

    showWeighbridgeModal() {
        const modal = document.getElementById('modal');
        const vehicles = window.fleetManager ? window.fleetManager.vehicles : [];

        document.getElementById('modalTitle').textContent = '⚖️ Weighbridge Ticket';
        document.getElementById('modalBody').innerHTML = `
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
                Enter weighbridge ticket data. Nett tonnage is calculated automatically from gross minus tare.
                Alternatively, enter nett tonnes directly.
            </p>
            <form id="weighbridgeForm">
                <div class="form-group">
                    <label>Ticket Number (optional)</label>
                    <input type="text" name="ticket_no" placeholder="e.g. WB-001234">
                </div>
                <div class="form-group">
                    <label>Vehicle</label>
                    <select name="vehicle_id">
                        <option value="">Unknown / not listed</option>
                        ${vehicles.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Material Type</label>
                    <select name="material_type">
                        <option value="limestone">Limestone (run of quarry)</option>
                        <option value="6mm">6mm</option>
                        <option value="10mm">10mm</option>
                        <option value="14mm">14mm</option>
                        <option value="20mm">20mm</option>
                        <option value="40mm">40mm</option>
                        <option value="dust">Dust / Fines</option>
                        <option value="oversize">Oversize</option>
                    </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div class="form-group" style="margin-bottom:0">
                        <label>Gross Weight (kg)</label>
                        <input type="number" name="gross_kg" step="10" placeholder="e.g. 55200" id="wb-gross">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label>Tare Weight (kg)</label>
                        <input type="number" name="tare_kg" step="10" placeholder="e.g. 24000" id="wb-tare">
                    </div>
                </div>
                <div style="text-align:center;padding:10px 0;font-size:13px;color:var(--text-tertiary);">— or enter nett directly —</div>
                <div class="form-group">
                    <label>Nett Tonnes (override)</label>
                    <input type="number" name="nett_tonnes" step="0.01" placeholder="Leave blank to calculate from gross/tare" id="wb-nett">
                </div>
                <div class="form-group">
                    <label>Zone / Delivery</label>
                    <input type="text" name="zone" placeholder="e.g. Crusher, Stockpile A, Customer delivery">
                </div>
                <div id="wb-calc-preview" style="display:none;background:rgba(63,185,80,0.1);border:1px solid rgba(63,185,80,0.3);border-radius:6px;padding:10px;font-size:13px;color:var(--accent-green);margin-bottom:12px;"></div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Log Ticket</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        // Live nett preview
        const updatePreview = () => {
            const gross = parseFloat(document.getElementById('wb-gross')?.value);
            const tare = parseFloat(document.getElementById('wb-tare')?.value);
            const nettOverride = parseFloat(document.getElementById('wb-nett')?.value);
            const preview = document.getElementById('wb-calc-preview');
            if (!preview) return;
            if (nettOverride > 0) {
                preview.style.display = 'block';
                preview.textContent = `✅ Nett: ${nettOverride.toFixed(2)}t (manually entered)`;
            } else if (gross > 0 && tare > 0 && gross > tare) {
                const nett = (gross - tare) / 1000;
                preview.style.display = 'block';
                preview.textContent = `✅ Nett: ${nett.toFixed(2)}t (${gross.toFixed(0)}kg gross − ${tare.toFixed(0)}kg tare)`;
            } else {
                preview.style.display = 'none';
            }
        };
        document.getElementById('wb-gross')?.addEventListener('input', updatePreview);
        document.getElementById('wb-tare')?.addEventListener('input', updatePreview);
        document.getElementById('wb-nett')?.addEventListener('input', updatePreview);

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('weighbridgeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const payload = Object.fromEntries(fd);
            try {
                const res = await fetch('api/weighbridge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (!res.ok) {
                    alert(result.error || 'Weighbridge log failed');
                    return;
                }
                modal.style.display = 'none';
                await this.loadLogs();
                await this.renderStats();
                this.renderLogs();
                this.updateChart();
                if (window.kpiManager) kpiManager.refresh();
                if (window.fleetManager) fleetManager.refresh();
                if (window.stockpileManager) stockpileManager.refresh();
                const spMsg = result.stockpile_updated ? ' · Stockpile updated' : '';
                window.toast && window.toast(`⚖️ ${result.message}${spMsg}`, 'success');
            } catch (err) {
                console.error('Weighbridge error:', err);
                window.toast && window.toast('Failed to log weighbridge ticket', 'error');
            }
        });
    }

    showLogModal() {
        const modal = document.getElementById('modal');
        const vehicles = window.fleetManager ? window.fleetManager.vehicles : [];

        document.getElementById('modalTitle').textContent = 'Log Load';
        document.getElementById('modalBody').innerHTML = `
            <form id="logProductionForm">
                <div class="form-group">
                    <label>Vehicle</label>
                    <select name="vehicle_id" required>
                        <option value="">Select vehicle...</option>
                        ${vehicles.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Tonnes Loaded</label>
                    <input type="number" name="tonnes" step="0.1" required placeholder="e.g. 25.5">
                </div>
                <div class="form-group">
                    <label>Material Type</label>
                    <select name="material_type">
                        <option value="limestone">Limestone (run of quarry)</option>
                        <option value="6mm">6mm</option>
                        <option value="10mm">10mm</option>
                        <option value="14mm">14mm</option>
                        <option value="20mm">20mm</option>
                        <option value="40mm">40mm</option>
                        <option value="dust">Dust / Fines</option>
                        <option value="oversize">Oversize</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Zone / Face</label>
                    <input type="text" name="zone" placeholder="e.g. Face A, Crusher, Top Road">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Log Load</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('logProductionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            await this.logProduction(data);
            modal.style.display = 'none';
        });
    }

    async logProduction(data) {
        try {
            await fetch('api/production', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            await this.loadLogs();
            await this.renderStats();
            this.renderLogs();
            this.updateChart();

            if (window.kpiManager) kpiManager.refresh();
            // Refresh fleet (vehicle hours auto-increment)
            if (window.fleetManager) fleetManager.refresh();
            // Refresh stockpiles (production auto-updates matching stockpile)
            if (window.stockpileManager) stockpileManager.refresh();
            window.toast && window.toast(`📊 Load logged: ${parseFloat(data.tonnes).toFixed(1)}t ${data.material_type || ''}`, 'success');
        } catch (error) {
            console.error('Failed to log production:', error);
            window.toast && window.toast('Failed to log production', 'error');
        }
    }
}

let productionManager;
document.addEventListener('DOMContentLoaded', () => {
    productionManager = new ProductionManager();
});
