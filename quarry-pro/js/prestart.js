// QuarryPro - Pre-start Checklist (PUWER) v2.1

const PRESTART_ITEMS = [
    { id: 'lights_front',    label: 'Front lights working',          category: 'Lighting' },
    { id: 'lights_rear',     label: 'Rear lights / tail lights',     category: 'Lighting' },
    { id: 'beacon',          label: 'Amber beacon / strobe',         category: 'Lighting' },
    { id: 'mirrors',         label: 'All mirrors clean & adjusted',  category: 'Visibility' },
    { id: 'camera',          label: 'Reversing camera / alarm',      category: 'Visibility' },
    { id: 'horn',            label: 'Horn working',                  category: 'Visibility' },
    { id: 'brakes_service',  label: 'Service brakes effective',      category: 'Brakes' },
    { id: 'brakes_park',     label: 'Parking brake holds',           category: 'Brakes' },
    { id: 'tyres',           label: 'Tyres / tracks — no damage',    category: 'Running Gear' },
    { id: 'undercarriage',   label: 'Undercarriage / wheels secure', category: 'Running Gear' },
    { id: 'seatbelt',        label: 'Seat belt fitted & working',    category: 'Safety Devices' },
    { id: 'fops_rops',       label: 'FOPS / ROPS structure intact',  category: 'Safety Devices' },
    { id: 'extinguisher',    label: 'Fire extinguisher present & in date', category: 'Safety Devices' },
    { id: 'first_aid',       label: 'First aid kit on board',        category: 'Safety Devices' },
    { id: 'oil_level',       label: 'Engine oil at correct level',   category: 'Fluids' },
    { id: 'coolant',         label: 'Coolant level OK',              category: 'Fluids' },
    { id: 'hydraulic_fluid', label: 'Hydraulic fluid level OK',      category: 'Fluids' },
    { id: 'no_leaks',        label: 'No visible fluid leaks',        category: 'Fluids' },
    { id: 'dump_body',       label: 'Dump body / bucket — no cracks or damage', category: 'Bodywork' },
    { id: 'tail_gate',       label: 'Tailgate / door closes properly', category: 'Bodywork' },
    { id: 'no_damage',       label: 'No new damage since last use',  category: 'Bodywork' },
    { id: 'cab_clean',       label: 'Cab clean, no loose items',     category: 'Cab' },
    { id: 'controls',        label: 'All controls working as expected', category: 'Cab' },
    { id: 'gauges',          label: 'Warning lights clear on start-up', category: 'Cab' },
];

class PreStartManager {
    constructor() {
        this.checks = [];
        this.init();
    }

    async init() {
        await this.loadRecentChecks();
        this.renderRecentChecks();
        this.setupEventListeners();
    }

    async loadRecentChecks() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`api/pre-start?date=${today}&limit=30`);
            this.checks = await response.json();
        } catch (e) {
            this.checks = [];
        }
    }

    renderRecentChecks() {
        const container = document.getElementById('prestartList');
        if (!container) return;

        const today = new Date().toISOString().split('T')[0];
        const todayChecks = this.checks.filter(c => c.date === today);
        const passCount = todayChecks.filter(c => c.overall_pass).length;
        const failCount = todayChecks.filter(c => !c.overall_pass).length;

        const summary = `
            <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
                <span class="alert-badge ok">✓ Passed today: ${passCount}</span>
                ${failCount > 0 ? `<span class="alert-badge danger">✗ Failed today: ${failCount}</span>` : ''}
                <span class="alert-badge" style="background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-secondary);">Total: ${todayChecks.length}</span>
            </div>`;

        if (this.checks.length === 0) {
            container.innerHTML = summary + '<p class="info-text">No pre-start checks submitted today. Click "+ New Check" to begin.</p>';
            return;
        }

        container.innerHTML = summary + this.checks.map(c => {
            const parsedChecks = this.parseChecks(c.checks);
            const failedItems = parsedChecks.filter(i => !i.passed);
            const ts = new Date(c.submitted_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="prestart-card ${c.overall_pass ? 'pass' : 'fail'}">
                    <div class="prestart-card-header">
                        <div>
                            <span class="prestart-vehicle">${c.vehicle_name || 'Unknown'}</span>
                            <span class="prestart-worker">${c.worker_name || 'Anonymous'} · ${ts}</span>
                        </div>
                        <span class="prestart-result ${c.overall_pass ? 'pass' : 'fail'}">
                            ${c.overall_pass ? '✓ PASS' : '✗ FAIL'}
                        </span>
                    </div>
                    <div class="prestart-progress">
                        <div class="prestart-prog-bar" style="width:${Math.round((parsedChecks.filter(i=>i.passed).length/parsedChecks.length)*100)}%"></div>
                    </div>
                    <div class="prestart-stat">${parsedChecks.filter(i=>i.passed).length}/${parsedChecks.length} items passed</div>
                    ${failedItems.length > 0 ? `
                        <div class="prestart-failures">
                            ${failedItems.map(i => `<span class="prestart-fail-item">✗ ${i.label}</span>`).join('')}
                        </div>` : ''}
                    ${c.defects ? `<div class="prestart-defects">📋 Defects noted: ${c.defects}</div>` : ''}
                </div>`;
        }).join('');
    }

    parseChecks(raw) {
        try {
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { return []; }
    }

    setupEventListeners() {
        const btn = document.getElementById('newPreStart');
        if (btn) btn.addEventListener('click', () => this.showCheckModal());
    }

    showCheckModal() {
        const modal = document.getElementById('modal');
        const vehicles = window.fleetManager ? window.fleetManager.vehicles : [];
        const workers = window.rosterManager ? window.rosterManager.workers : [];

        // Group check items by category
        const categories = [...new Set(PRESTART_ITEMS.map(i => i.category))];

        document.getElementById('modalTitle').textContent = '🔍 Pre-start Inspection (PUWER)';
        document.getElementById('modalBody').innerHTML = `
            <form id="prestartForm" style="max-height:70vh;overflow-y:auto;padding-right:4px;">
                <div class="form-group">
                    <label>Vehicle *</label>
                    <select name="vehicle_id" id="ps-vehicle" required>
                        <option value="">Select vehicle...</option>
                        ${vehicles.map(v => `<option value="${v.id}">${v.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Operator Name *</label>
                    <input type="text" name="worker_name" required placeholder="Your name" id="ps-worker-name">
                </div>
                <div id="ps-checklist" style="margin-top:8px;">
                    ${categories.map(cat => `
                        <div class="ps-category">
                            <div class="ps-cat-label">${cat}</div>
                            ${PRESTART_ITEMS.filter(i => i.category === cat).map(item => `
                                <div class="ps-item">
                                    <label class="ps-item-label">
                                        <div class="ps-item-text">${item.label}</div>
                                        <div class="ps-toggle-group">
                                            <label class="ps-toggle pass">
                                                <input type="radio" name="check_${item.id}" value="pass" checked>
                                                <span>✓ OK</span>
                                            </label>
                                            <label class="ps-toggle fail">
                                                <input type="radio" name="check_${item.id}" value="fail">
                                                <span>✗ Fail</span>
                                            </label>
                                        </div>
                                    </label>
                                </div>`).join('')}
                        </div>`).join('')}
                </div>
                <div class="form-group" style="margin-top:12px;">
                    <label>Defects / Notes</label>
                    <textarea name="defects" rows="2" style="width:100%;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-primary);padding:10px;border-radius:6px;font-size:14px;resize:vertical;" placeholder="Describe any defects or issues (leave blank if none)..."></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary" id="ps-submit">Submit Inspection</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        // Highlight fail radio items in red dynamically
        document.querySelectorAll('.ps-toggle.fail input').forEach(input => {
            input.addEventListener('change', (e) => {
                const itemRow = e.target.closest('.ps-item');
                if (e.target.checked) itemRow.classList.add('has-fail');
            });
        });
        document.querySelectorAll('.ps-toggle.pass input').forEach(input => {
            input.addEventListener('change', (e) => {
                const itemRow = e.target.closest('.ps-item');
                if (e.target.checked) itemRow.classList.remove('has-fail');
            });
        });

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('prestartForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const vehicleId = fd.get('vehicle_id');
            const workerName = fd.get('worker_name');
            const defects = fd.get('defects');

            const checksData = PRESTART_ITEMS.map(item => ({
                id: item.id,
                label: item.label,
                category: item.category,
                passed: fd.get(`check_${item.id}`) !== 'fail'
            }));

            const overallPass = checksData.every(c => c.passed);

            document.getElementById('ps-submit').disabled = true;
            document.getElementById('ps-submit').textContent = 'Submitting...';

            await fetch('api/pre-start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicle_id: vehicleId,
                    worker_name: workerName,
                    checks: checksData,
                    overall_pass: overallPass,
                    defects: defects || null
                })
            });

            modal.style.display = 'none';
            await this.loadRecentChecks();
            this.renderRecentChecks();

            // Refresh fleet in case vehicle was flagged
            if (window.fleetManager) fleetManager.refresh();
        });
    }
}

let preStartManager;
document.addEventListener('DOMContentLoaded', () => {
    preStartManager = new PreStartManager();
});
