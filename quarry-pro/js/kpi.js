// QuarryPro - KPI Dashboard v2.3

class KPIManager {
    constructor() {
        this.weeklyChart = null;
        this.chartPeriod = '7d'; // '7d' or '30d'
        this.init();
        window.addEventListener('qpro:simulation-snapshot', (event) => this.applySimulationSnapshot(event.detail));
        setInterval(() => this.refresh(), 30000);
    }

    async init() {
        await this.refresh();
        await this.buildTrendChart();
        this.setupPeriodToggle();
    }

    async refresh() {
        try {
            const response = await fetch('api/kpis/today');
            const kpis = await response.json();

            // Main KPI panel
            this.setText('kpi-utilisation', `${kpis.utilisation}%`);
            this.setText('kpi-tonnes', `${parseFloat(kpis.total_tonnes).toFixed(1)} t`);
            this.setText('kpi-productivity', `${kpis.tonnes_per_hour} t/h`);
            this.setText('kpi-active', `${kpis.active_vehicles} / ${kpis.total_vehicles}`);
            this.setText('kpi-idle', kpis.idle_vehicles || 0);
            this.setText('kpi-down', kpis.down_vehicles || 0);
            this.setText('kpi-estimated-day', `Est. end of shift: ${kpis.estimated_day_total} t`);

            // Colour code utilisation
            const utilEl = document.getElementById('kpi-utilisation');
            if (utilEl) {
                const u = parseFloat(kpis.utilisation);
                utilEl.style.color = u >= 85 ? 'var(--accent-green)' : u >= 60 ? 'var(--accent-yellow)' : 'var(--accent-red)';
            }

            // Target bar
            const pct = parseFloat(kpis.target_pct);
            const bar = document.getElementById('kpi-target-bar');
            if (bar) {
                bar.style.width = `${Math.min(100, pct)}%`;
                if (pct >= 100) bar.classList.add('over');
                else bar.classList.remove('over');
            }
            this.setText('kpi-target-label', `${parseFloat(kpis.total_tonnes).toFixed(0)} / ${kpis.daily_target} t (${pct}%)`);

            // Header mini KPIs
            this.setText('header-tonnes', parseFloat(kpis.total_tonnes).toFixed(0));
            this.setText('header-utilisation', `${kpis.utilisation}%`);
            this.setText('header-active', `${kpis.active_vehicles}/${kpis.total_vehicles}`);

            // Shift elapsed badge (also updated by clock, but keep in sync)
            this.setText('shift-elapsed-badge', `⏱ Shift: ${kpis.shift_elapsed_hours}h`);

            // Update trend chart if built
            if (this.weeklyChart) this.updateTrendChart();

        } catch (error) {
            console.error('Failed to refresh KPIs:', error);
        }
    }

    setupPeriodToggle() {
        const btn7 = document.getElementById('period-7d');
        const btn30 = document.getElementById('period-30d');
        if (!btn7 || !btn30) return;

        btn7.addEventListener('click', () => {
            if (this.chartPeriod === '7d') return;
            this.chartPeriod = '7d';
            btn7.classList.add('active');
            btn30.classList.remove('active');
            this.updateTrendChart();
        });

        btn30.addEventListener('click', () => {
            if (this.chartPeriod === '30d') return;
            this.chartPeriod = '30d';
            btn30.classList.add('active');
            btn7.classList.remove('active');
            this.updateTrendChart();
        });
    }

    async buildTrendChart() {
        const canvas = document.getElementById('weeklyChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const data = await this.getTrendData();

        this.weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    {
                        label: 'Tonnes',
                        data: data.tonnes,
                        backgroundColor: data.isToday.map(t => t ? '#3fb950' : '#2f81f7'),
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Loads',
                        data: data.loads,
                        type: 'line',
                        borderColor: '#d29922',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: data.labels.length > 14 ? 2 : 4,
                        pointBackgroundColor: '#d29922',
                        tension: 0.3,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#8b949e', font: { size: 11 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ctx.dataset.label === 'Tonnes'
                                ? `${ctx.parsed.y.toFixed(1)} t`
                                : `${ctx.parsed.y} loads`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left',
                        grid: { color: '#30363d' },
                        ticks: { color: '#8b949e', callback: v => v + 't' }
                    },
                    y2: {
                        beginAtZero: true,
                        position: 'right',
                        grid: { display: false },
                        ticks: { color: '#d29922' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#8b949e',
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    }
                }
            }
        });
    }

    async updateTrendChart() {
        if (!this.weeklyChart) return;
        const data = await this.getTrendData();
        this.weeklyChart.data.labels = data.labels;
        this.weeklyChart.data.datasets[0].data = data.tonnes;
        this.weeklyChart.data.datasets[0].backgroundColor = data.isToday.map(t => t ? '#3fb950' : '#2f81f7');
        this.weeklyChart.data.datasets[1].data = data.loads;
        // Smaller dots for 30-day view
        this.weeklyChart.data.datasets[1].pointRadius = data.labels.length > 14 ? 2 : 4;
        this.weeklyChart.update();
    }

    async getTrendData() {
        try {
            const endpoint = this.chartPeriod === '30d'
                ? 'api/production/monthly'
                : 'api/production/weekly';
            const response = await fetch(endpoint);
            const rows = await response.json();
            const today = new Date().toISOString().split('T')[0];

            // Build N days including blanks
            const numDays = this.chartPeriod === '30d' ? 30 : 7;
            const days = [];
            for (let i = numDays - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                days.push(d.toISOString().split('T')[0]);
            }

            // 30-day labels: shorter format (day/month)
            const labelFmt = this.chartPeriod === '30d'
                ? { day: 'numeric', month: 'short' }
                : { weekday: 'short', day: 'numeric' };

            return {
                labels: days.map(d => {
                    const dt = new Date(d + 'T12:00:00');
                    return dt.toLocaleDateString('en-GB', labelFmt);
                }),
                tonnes: days.map(d => {
                    const r = rows.find(r => r.date === d);
                    return r ? parseFloat(r.tonnes) : 0;
                }),
                loads: days.map(d => {
                    const r = rows.find(r => r.date === d);
                    return r ? parseInt(r.loads) : 0;
                }),
                isToday: days.map(d => d === today)
            };
        } catch {
            return { labels: [], tonnes: [], loads: [], isToday: [] };
        }
    }

    setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    applySimulationSnapshot(snapshot) {
        if (!snapshot) return;
        const targetPct = snapshot.dailyTarget > 0
            ? Math.min(100, (snapshot.tonnesToday / snapshot.dailyTarget) * 100)
            : 0;
        const active = (snapshot.activeEquipment || []).filter(eq => eq.state && !String(eq.state).includes('idle')).length;
        const total = Object.values(snapshot.equipmentCounts || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
        const util = total > 0 ? Math.round((active / total) * 100) : 0;

        this.setText('kpi-utilisation', `${util}%`);
        this.setText('kpi-tonnes', `${snapshot.tonnesToday.toFixed(1)} t`);
        this.setText('kpi-productivity', `${Math.round(snapshot.material.localSellableProduct || 0)} t stock`);
        this.setText('kpi-active', `${active} / ${total}`);
        this.setText('kpi-idle', Math.max(0, total - active));
        this.setText('kpi-estimated-day', `Dust ${Math.round(snapshot.dust.index)} · Water ${snapshot.water.risk}`);
        this.setText('kpi-target-label', `${snapshot.tonnesToday.toFixed(0)} / ${snapshot.dailyTarget} t (${Math.round(targetPct)}%)`);
        this.setText('header-tonnes', snapshot.tonnesToday.toFixed(0));
        this.setText('header-utilisation', `${util}%`);
        this.setText('header-active', `${active}/${total}`);

        const bar = document.getElementById('kpi-target-bar');
        if (bar) bar.style.width = `${targetPct}%`;
    }
}

let kpiManager;
document.addEventListener('DOMContentLoaded', () => {
    kpiManager = new KPIManager();
    window.kpiManager = kpiManager;
});
