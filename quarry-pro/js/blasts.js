// QuarryPro - Blast Events Panel v2.4

class BlastManager {
    constructor() {
        this.blasts = [];
        this.init();
    }

    init() {
        document.getElementById('logBlast').addEventListener('click', () => this.showLogModal());
    }

    async refresh() {
        try {
            const res = await fetch('api/blasts');
            this.blasts = await res.json();
            this.render();
        } catch (e) {
            console.error('Blast load error:', e);
        }
    }

    render() {
        const el = document.getElementById('blastList');
        if (!el) return;

        if (this.blasts.length === 0) {
            el.innerHTML = `
                <div class="empty-state">
                    <div style="font-size:48px;margin-bottom:12px;">💥</div>
                    <p>No blast events logged yet.</p>
                    <p style="font-size:12px;color:var(--text-tertiary);margin-top:6px;">Log a blast to track yield reconciliation and regulatory records.</p>
                </div>`;
            return;
        }

        el.innerHTML = this.blasts.map(b => {
            const yieldMatch = b.estimated_yield_tonnes && b.actual_yield_tonnes
                ? parseFloat(b.actual_yield_tonnes) / parseFloat(b.estimated_yield_tonnes)
                : null;
            const yieldClass = yieldMatch === null ? '' : yieldMatch >= 0.9 ? 'success' : yieldMatch >= 0.7 ? 'warn' : 'error';
            const yieldLabel = yieldMatch === null ? '—' : `${(yieldMatch * 100).toFixed(0)}% yield`;

            return `<div class="blast-card">
                <div class="blast-card-header">
                    <div class="blast-meta">
                        <strong class="blast-face">${b.face_location}</strong>
                        <span class="blast-date">${new Date(b.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div class="blast-badges">
                        ${yieldMatch !== null ? `<span class="blast-yield-badge ${yieldClass}">${yieldLabel}</span>` : ''}
                        <button class="btn-icon" title="Update actual yield" onclick="blastManager.showUpdateModal(${b.id})">✏️</button>
                    </div>
                </div>
                <div class="blast-stats">
                    ${b.holes_drilled ? `<div class="blast-stat"><strong>${b.holes_drilled}</strong> holes</div>` : ''}
                    ${b.charge_weight_kg ? `<div class="blast-stat"><strong>${parseFloat(b.charge_weight_kg).toFixed(0)}kg</strong> charge</div>` : ''}
                    ${b.estimated_yield_tonnes ? `<div class="blast-stat"><strong>${parseFloat(b.estimated_yield_tonnes).toFixed(0)}t</strong> est. yield</div>` : ''}
                    ${b.actual_yield_tonnes ? `<div class="blast-stat highlight"><strong>${parseFloat(b.actual_yield_tonnes).toFixed(0)}t</strong> actual yield</div>` : '<div class="blast-stat muted">Actual yield pending</div>'}
                    ${b.clearance_time ? `<div class="blast-stat"><strong>${b.clearance_time}</strong> clearance</div>` : ''}
                </div>
                ${b.operator || b.safety_officer ? `
                    <div class="blast-personnel">
                        ${b.operator ? `<span>👷 ${b.operator}</span>` : ''}
                        ${b.safety_officer ? `<span>🦺 ${b.safety_officer}</span>` : ''}
                    </div>` : ''}
                ${b.pattern ? `<div class="blast-notes">Pattern: ${b.pattern}</div>` : ''}
                ${b.notes ? `<div class="blast-notes">${b.notes}</div>` : ''}
            </div>`;
        }).join('');
    }

    showLogModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = '💥 Log Blast Event';
        document.getElementById('modalBody').innerHTML = `
            <div class="form-grid">
                <div class="form-group">
                    <label>Date *</label>
                    <input type="date" id="blast-date" class="input" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Face / Location *</label>
                    <input type="text" id="blast-face" class="input" placeholder="e.g. North Face Level 3">
                </div>
                <div class="form-group">
                    <label>Blast Pattern</label>
                    <input type="text" id="blast-pattern" class="input" placeholder="e.g. 5x3m grid, 8m bench">
                </div>
                <div class="form-group">
                    <label>Holes Drilled</label>
                    <input type="number" id="blast-holes" class="input" min="1" placeholder="e.g. 24">
                </div>
                <div class="form-group">
                    <label>Charge Weight (kg)</label>
                    <input type="number" id="blast-charge" class="input" step="0.5" placeholder="e.g. 450">
                </div>
                <div class="form-group">
                    <label>Estimated Yield (tonnes)</label>
                    <input type="number" id="blast-est" class="input" step="10" placeholder="e.g. 2500">
                </div>
                <div class="form-group">
                    <label>Actual Yield (tonnes)</label>
                    <input type="number" id="blast-actual" class="input" step="10" placeholder="Fill in after survey">
                </div>
                <div class="form-group">
                    <label>Clearance Time</label>
                    <input type="text" id="blast-clearance" class="input" placeholder="e.g. 14:30">
                </div>
                <div class="form-group">
                    <label>Blaster / Operator</label>
                    <input type="text" id="blast-operator" class="input" placeholder="Name">
                </div>
                <div class="form-group">
                    <label>Safety Officer</label>
                    <input type="text" id="blast-safety" class="input" placeholder="Name">
                </div>
            </div>
            <div class="form-group" style="margin-top:12px;">
                <label>Notes</label>
                <textarea id="blast-notes" class="input" rows="3" placeholder="Misfires, ground conditions, sequence notes..."></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none'">Cancel</button>
                <button class="btn-primary" id="submitBlast">Log Blast</button>
            </div>
        `;
        modal.style.display = 'flex';

        document.getElementById('submitBlast').addEventListener('click', () => this.submitBlast());

        // Enter key shortcut
        document.getElementById('modalBody').querySelectorAll('input').forEach(input => {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') this.submitBlast(); });
        });
    }

    async submitBlast() {
        const face = document.getElementById('blast-face').value.trim();
        if (!face) {
            window.toast('Face / location is required', 'warn');
            return;
        }

        const payload = {
            date: document.getElementById('blast-date').value,
            face_location: face,
            pattern: document.getElementById('blast-pattern').value.trim() || null,
            holes_drilled: document.getElementById('blast-holes').value || null,
            charge_weight_kg: document.getElementById('blast-charge').value || null,
            estimated_yield_tonnes: document.getElementById('blast-est').value || null,
            actual_yield_tonnes: document.getElementById('blast-actual').value || null,
            clearance_time: document.getElementById('blast-clearance').value.trim() || null,
            operator: document.getElementById('blast-operator').value.trim() || null,
            safety_officer: document.getElementById('blast-safety').value.trim() || null,
            notes: document.getElementById('blast-notes').value.trim() || null,
        };

        try {
            const res = await fetch('api/blasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (data.id) {
                document.getElementById('modal').style.display = 'none';
                await this.refresh();
                window.toast(`Blast logged: ${face}`, 'success');
            }
        } catch (e) {
            window.toast('Failed to log blast event', 'error');
        }
    }

    showUpdateModal(id) {
        const blast = this.blasts.find(b => b.id === id);
        if (!blast) return;

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = '✏️ Update Blast Yield';
        document.getElementById('modalBody').innerHTML = `
            <p style="color:var(--text-secondary);margin-bottom:16px;">
                <strong>${blast.face_location}</strong> — ${new Date(blast.date + 'T12:00:00').toLocaleDateString('en-GB')}
            </p>
            <div class="form-group">
                <label>Estimated Yield (tonnes)</label>
                <input type="number" id="upd-est" class="input" value="${blast.estimated_yield_tonnes || ''}">
            </div>
            <div class="form-group">
                <label>Actual Yield (tonnes)</label>
                <input type="number" id="upd-actual" class="input" value="${blast.actual_yield_tonnes || ''}">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea id="upd-notes" class="input" rows="3">${blast.notes || ''}</textarea>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none'">Cancel</button>
                <button class="btn-primary" id="submitUpdate">Save</button>
            </div>
        `;
        modal.style.display = 'flex';

        document.getElementById('submitUpdate').addEventListener('click', async () => {
            const payload = {
                actual_yield_tonnes: document.getElementById('upd-actual').value || null,
                notes: document.getElementById('upd-notes').value.trim() || null,
            };
            await fetch(`api/blasts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            document.getElementById('modal').style.display = 'none';
            await this.refresh();
            window.toast('Blast updated', 'success');
        });
    }
}

window.blastManager = new BlastManager();
