// QuarryPro - Shift Roster Management v2.0

class RosterManager {
    constructor() {
        this.workers = [];
        this.init();
    }

    async init() {
        await this.loadWorkers();
        this.renderWorkers();
        this.setupEventListeners();
    }

    async loadWorkers() {
        try {
            const response = await fetch('api/workers');
            this.workers = await response.json();
        } catch (error) {
            console.error('Failed to load workers:', error);
        }
    }

    statusColor(status) {
        const map = { on: 'working', off: 'idle', leave: 'maintenance', sick: 'breakdown' };
        return map[status] || 'idle';
    }

    attendanceScore(w) {
        const sick = w.sick_days || 0;
        const worked = w.days_worked || 0;
        const total = sick + worked;
        if (total === 0) return null; // not enough data yet

        // Score: 100 minus penalty for sick days
        // Each sick day = -8 points, capped at 0
        const score = Math.max(0, Math.round(100 - (sick / Math.max(total, 1)) * 100));
        return score;
    }

    scoreLabel(score) {
        if (score === null) return { label: 'New', color: '#666', bg: '#2a2a2a', icon: '⭐' };
        if (score >= 95) return { label: 'Excellent', color: '#00e676', bg: '#003318', icon: '🏆' };
        if (score >= 85) return { label: 'Good',      color: '#69f0ae', bg: '#00291a', icon: '✅' };
        if (score >= 70) return { label: 'Fair',      color: '#ffd740', bg: '#2a2200', icon: '⚠️' };
        if (score >= 50) return { label: 'Poor',      color: '#ff9100', bg: '#2a1500', icon: '📉' };
        return               { label: 'Critical',    color: '#ff5252', bg: '#2a0000', icon: '🚨' };
    }

    renderAttendanceBadge(w) {
        const score = this.attendanceScore(w);
        const { label, color, bg, icon } = this.scoreLabel(score);
        const scoreText = score !== null ? `${score}%` : '—';
        const sick = w.sick_days || 0;
        const worked = w.days_worked || 0;
        return `
            <div class="attendance-badge" style="background:${bg};border:1px solid ${color}33;" title="${worked} days worked, ${sick} sick days">
                <span class="att-icon">${icon}</span>
                <div class="att-info">
                    <span class="att-score" style="color:${color}">${scoreText}</span>
                    <span class="att-label" style="color:${color}aa">${label}</span>
                </div>
                <div class="att-bar-wrap">
                    <div class="att-bar" style="width:${score !== null ? score : 50}%;background:${color};"></div>
                </div>
            </div>`;
    }

    renderWorkers() {
        const container = document.getElementById('workerList');
        if (!container) return;

        // Summary row
        const onDuty = this.workers.filter(w => w.status === 'on').length;
        const summary = `
            <div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">
                <span class="alert-badge ok">✓ On duty: ${onDuty}</span>
                <span class="alert-badge warn">Off: ${this.workers.filter(w => w.status === 'off').length}</span>
                <span class="alert-badge danger">Sick: ${this.workers.filter(w => w.status === 'sick').length}</span>
            </div>`;

        if (this.workers.length === 0) {
            container.innerHTML = summary + '<p class="info-text">No workers registered. Click "+ Add Worker" to get started.</p>';
            return;
        }

        container.innerHTML = summary + this.workers.map(w => `
            <div class="worker-card">
                <div class="worker-name">${w.name}</div>
                <div class="worker-role">${this.roleLabel(w.role)}</div>
                ${this.renderAttendanceBadge(w)}
                <div class="worker-info">
                    <div><strong>Shift:</strong> ${this.shiftLabel(w.shift)}</div>
                    <div><strong>Hire:</strong> ${this.moneyLabel(w.hire_cost || w.hireCost || 0)}</div>
                    <div><strong>Tickets:</strong> ${this.ticketChips(w)}</div>
                    ${w.phone ? `<div><strong>📞</strong> ${w.phone}</div>` : ''}
                    <div class="att-stats">📅 ${w.days_worked || 0} days worked &nbsp;·&nbsp; 🤒 ${w.sick_days || 0} sick days
                      <button class="btn-edit-att" data-worker-id="${w.id}" data-name="${w.name}" title="Edit attendance">✏️</button>
                    </div>
                </div>
                <div class="worker-actions">
                    <select class="status-select" data-worker-id="${w.id}">
                        <option value="off" ${w.status === 'off' ? 'selected' : ''}>Off Duty</option>
                        <option value="on" ${w.status === 'on' ? 'selected' : ''}>On Duty</option>
                        <option value="leave" ${w.status === 'leave' ? 'selected' : ''}>Annual Leave</option>
                        <option value="sick" ${w.status === 'sick' ? 'selected' : ''}>Sick</option>
                    </select>
                    <span class="vehicle-status ${this.statusColor(w.status)}" style="font-size:11px;">${w.status}</span>
                    <button class="btn-secondary view-worker-profile" data-worker-id="${w.id}" title="View tickets and hire cost">Profile</button>
                    <button class="btn-secondary delete-worker" data-worker-id="${w.id}" title="Remove worker">🗑️</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateWorkerStatus(e.target.dataset.workerId, e.target.value);
            });
        });

        document.querySelectorAll('.delete-worker').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('[data-worker-id]').dataset.workerId;
                const worker = this.workers.find(w => w.id == id);
                if (confirm(`Remove ${worker ? worker.name : 'this worker'} from roster?`)) {
                    this.deleteWorker(id);
                }
            });
        });

        document.querySelectorAll('.btn-edit-att').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.workerId;
                const worker = this.workers.find(w => w.id == id);
                if (worker) this.showAttendanceModal(worker);
            });
        });

        document.querySelectorAll('.view-worker-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.workerId;
                const worker = this.workers.find(w => w.id == id);
                if (worker) this.showWorkerProfile(worker);
            });
        });
    }

    shiftLabel(shift) {
        const map = {
            day: 'Day (06:00–14:00)',
            afternoon: 'Afternoon (14:00–22:00)',
            night: 'Night (22:00–06:00)'
        };
        return map[shift] || shift || 'Not assigned';
    }

    roleLabel(role) {
        const map = {
            'tractor-driver': 'Tractor Driver',
            'maintenance-fitter': 'Maintenance Fitter',
            'general-labourer': 'General Labourer',
            'dumper-driver': 'Dumper Driver',
            'excavator-operator': 'Excavator Operator',
            'loader-operator': 'Loading Shovel Driver',
            'plant-operator': 'Plant Operator',
            supervisor: 'Supervisor',
            mechanic: 'Mechanic',
            banksman: 'Banksman / Signaller'
        };
        return map[role] || role || 'Operator';
    }

    ticketLabel(ticket) {
        const map = {
            dumper: 'Dumper',
            loader: 'Loading Shovel',
            excavator: 'Excavator',
            tractor: 'Tractor',
            maintenance: 'Plant Maintenance',
            greasing: 'Greasing / Yard Duties'
        };
        return map[ticket] || ticket || 'Ticket';
    }

    trainingCost(ticket) {
        const map = {
            greasing: 350,
            tractor: 600,
            dumper: 650,
            maintenance: 850,
            loader: 900,
            excavator: 1100
        };
        return map[ticket] || 0;
    }

    parseTickets(worker) {
        if (Array.isArray(worker.tickets)) return worker.tickets;
        if (typeof worker.tickets === 'string' && worker.tickets.trim()) {
            try {
                const parsed = JSON.parse(worker.tickets);
                if (Array.isArray(parsed)) return parsed;
            } catch (_) {}
            return worker.tickets.split(',').map(t => t.trim()).filter(Boolean);
        }
        if (worker.certifications) {
            return worker.certifications.split(',').map(t => t.trim()).filter(Boolean);
        }
        return [];
    }

    ticketChips(worker) {
        const tickets = this.parseTickets(worker);
        if (tickets.length === 0) return '<span style="color:#777;">No tickets listed</span>';
        return tickets.map(ticket => `<span class="alert-badge ok" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 7px;font-size:10px;">${this.ticketLabel(ticket)}</span>`).join('');
    }

    moneyLabel(value) {
        const amount = Number(value || 0);
        if (!amount) return 'Not priced';
        return `£${amount.toLocaleString('en-GB')}`;
    }

    availableTrainingTickets(worker) {
        const current = new Set(this.parseTickets(worker));
        return ['dumper', 'loader', 'excavator', 'tractor', 'maintenance', 'greasing']
            .filter(ticket => !current.has(ticket))
            .map(ticket => ({ ticket, label: this.ticketLabel(ticket), cost: this.trainingCost(ticket) }))
            .filter(item => item.cost > 0);
    }

    setupEventListeners() {
        const btn = document.getElementById('addWorker');
        if (btn) btn.addEventListener('click', () => this.showAddWorkerModal());
    }

    showAddWorkerModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Add Worker';
        document.getElementById('modalBody').innerHTML = `
            <form id="addWorkerForm">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" name="name" required placeholder="e.g. John Smith">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select name="role" required>
                        <option value="dumper-driver">Dumper Driver</option>
                        <option value="tractor-driver">Tractor Driver</option>
                        <option value="excavator-operator">Excavator Operator</option>
                        <option value="loader-operator">Loading Shovel Driver</option>
                        <option value="plant-operator">Plant Operator</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="maintenance-fitter">Maintenance Fitter</option>
                        <option value="general-labourer">General Labourer</option>
                        <option value="mechanic">Mechanic</option>
                        <option value="banksman">Banksman / Signaller</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Certifications</label>
                    <input type="text" name="certifications" placeholder="e.g. ADT, 360° Excavator, CPCS">
                </div>
                <div class="form-group">
                    <label>Shift</label>
                    <select name="shift">
                        <option value="day">Day (06:00–14:00)</option>
                        <option value="afternoon">Afternoon (14:00–22:00)</option>
                        <option value="night">Night (22:00–06:00)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Phone (optional)</label>
                    <input type="text" name="phone" placeholder="e.g. 07700 900123">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Add Worker</button>
                </div>
            </form>`;
        modal.style.display = 'block';

        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('addWorkerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            await this.addWorker(data);
            modal.style.display = 'none';
        });
    }

    async addWorker(data) {
        try {
            const response = await fetch('api/workers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const worker = await response.json();
            this.workers.push(worker);
            this.renderWorkers();
        } catch (error) {
            console.error('Failed to add worker:', error);
            alert('Failed to add worker');
        }
    }

    async updateWorkerStatus(id, status) {
        try {
            const resp = await fetch(`api/workers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await resp.json();
            const idx = this.workers.findIndex(w => w.id == id);
            if (idx !== -1 && data.worker) {
                this.workers[idx] = data.worker;
            } else if (idx !== -1) {
                this.workers[idx].status = status;
            }
            this.renderWorkers();
        } catch (error) {
            console.error('Failed to update worker:', error);
        }
    }

    showWorkerProfile(worker) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = `Driver Profile — ${worker.name}`;
        const tickets = this.parseTickets(worker);
        const ticketList = tickets.length
            ? tickets.map(ticket => `<li style="margin:6px 0;">🎫 ${this.ticketLabel(ticket)}</li>`).join('')
            : '<li style="color:#777;">No machine tickets listed yet</li>';
        const hireCost = worker.hire_cost || worker.hireCost || 0;
        const trainingOptions = this.availableTrainingTickets(worker);
        const trainingButtons = trainingOptions.length
            ? trainingOptions.map(item => `
                <button type="button" class="btn-secondary train-ticket-btn" data-worker-id="${worker.id}" data-ticket="${item.ticket}" style="margin:4px 4px 0 0;">
                    Train ${item.label} · ${this.moneyLabel(item.cost)}
                </button>`).join('')
            : '<div style="color:#777;font-size:12px;">All available starter tickets already held.</div>';
        document.getElementById('modalBody').innerHTML = `
            <div style="padding:14px;background:#111;border:1px solid #333;border-radius:10px;margin-bottom:14px;">
                <div style="font-size:20px;font-weight:800;color:#fff;">${worker.name}</div>
                <div style="color:#aaa;margin-top:4px;">${this.roleLabel(worker.role)}</div>
                <div style="margin-top:12px;font-size:22px;font-weight:800;color:#69f0ae;">${this.moneyLabel(hireCost)}</div>
                <div style="color:#888;font-size:12px;">Hire cost — multi-ticket staff cost more, single-machine dumper drivers are cheaper.</div>
            </div>
            <div style="padding:12px;background:#181818;border-radius:10px;margin-bottom:14px;">
                <div style="font-weight:700;margin-bottom:8px;color:#fff;">Machine Tickets / Licences</div>
                <ul style="margin:0;padding-left:18px;color:#ddd;">${ticketList}</ul>
            </div>
            <div style="padding:12px;background:#1b1710;border:1px solid #6b4b16;border-radius:10px;margin-bottom:14px;">
                <div style="font-weight:800;margin-bottom:6px;color:#ffd58a;">Train another ticket</div>
                <div style="color:#aaa;font-size:12px;margin-bottom:8px;">Training current staff is cheaper than hiring someone who already has the ticket. Their value rises, but not by the full hire cost.</div>
                <div>${trainingButtons}</div>
                <div style="color:#777;font-size:11px;margin-top:8px;">Training spend so far: ${this.moneyLabel(worker.training_spend || worker.trainingSpend || 0)}</div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                <div style="padding:10px;background:#101820;border-radius:8px;"><strong>Speed</strong><br>${Math.round((worker.speed || 0) * 100) || '—'}%</div>
                <div style="padding:10px;background:#101820;border-radius:8px;"><strong>Reliability</strong><br>${Math.round((worker.reliability || 0) * 100) || '—'}%</div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn-secondary" id="cancelModal">Close</button>
                <button type="button" class="btn-primary" id="editAttendanceFromProfile">Attendance</button>
            </div>`;
        modal.style.display = 'block';
        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('editAttendanceFromProfile').addEventListener('click', () => this.showAttendanceModal(worker));
        document.querySelectorAll('.train-ticket-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await this.trainWorkerTicket(btn.dataset.workerId, btn.dataset.ticket);
            });
        });
    }

    async trainWorkerTicket(id, ticket) {
        const worker = this.workers.find(w => w.id == id);
        const label = this.ticketLabel(ticket);
        const cost = this.trainingCost(ticket);
        if (!worker || !ticket) return;
        if (!confirm(`Train ${worker.name} for ${label} ticket for ${this.moneyLabel(cost)}?`)) return;
        try {
            const resp = await fetch(`api/workers/${id}/train-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket })
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || 'Training failed');
            const idx = this.workers.findIndex(w => w.id == id);
            if (idx !== -1) this.workers[idx] = data.worker;
            this.renderWorkers();
            this.showWorkerProfile(data.worker);
            if (window.toast) window.toast(data.message || `${worker.name} trained for ${label}`, 'success');
        } catch (error) {
            console.error('Failed to train worker:', error);
            alert(error.message || 'Failed to train worker');
        }
    }

    showAttendanceModal(worker) {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = `Attendance — ${worker.name}`;
        const score = this.attendanceScore(worker);
        const { label, color } = this.scoreLabel(score);
        document.getElementById('modalBody').innerHTML = `
            <div style="margin-bottom:16px;padding:12px;background:#1a1a1a;border-radius:8px;text-align:center;">
                <div style="font-size:28px;font-weight:700;color:${color}">${score !== null ? score + '%' : '—'}</div>
                <div style="color:${color}aa;font-size:13px;">${label} Attendance</div>
            </div>
            <form id="editAttForm">
                <div class="form-group">
                    <label>Days Worked</label>
                    <input type="number" name="days_worked" min="0" value="${worker.days_worked || 0}" required>
                </div>
                <div class="form-group">
                    <label>Sick Days</label>
                    <input type="number" name="sick_days" min="0" value="${worker.sick_days || 0}" required>
                </div>
                <p style="color:#666;font-size:12px;margin-top:8px;">Score = 100% minus sick day rate. Updates automatically when you mark someone as Sick or On Duty.</p>
                <div class="form-actions">
                    <button type="button" class="btn-secondary" id="cancelModal">Cancel</button>
                    <button type="submit" class="btn-primary">Save</button>
                </div>
            </form>`;
        modal.style.display = 'block';
        document.getElementById('cancelModal').addEventListener('click', () => { modal.style.display = 'none'; });
        document.getElementById('editAttForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            await this.updateAttendance(worker.id, parseInt(data.days_worked), parseInt(data.sick_days));
            modal.style.display = 'none';
        });
    }

    async updateAttendance(id, days_worked, sick_days) {
        try {
            const resp = await fetch(`api/workers/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days_worked, sick_days })
            });
            const data = await resp.json();
            const worker = this.workers.find(w => w.id == id);
            if (worker) { worker.days_worked = days_worked; worker.sick_days = sick_days; }
            this.renderWorkers();
        } catch (e) { console.error(e); }
    }

    async deleteWorker(id) {
        try {
            await fetch(`api/workers/${id}`, { method: 'DELETE' });
            this.workers = this.workers.filter(w => w.id != id);
            this.renderWorkers();
        } catch (error) {
            console.error('Failed to delete worker:', error);
        }
    }
}

let rosterManager;
document.addEventListener('DOMContentLoaded', () => {
    rosterManager = new RosterManager();
    window.rosterManager = rosterManager;
});
