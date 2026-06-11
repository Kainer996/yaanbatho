// QuarryPro - Analytics Panel v2.4

class AnalyticsManager {
    constructor() {
        this.range = 7;          // days (or 'today')
        this.data = null;
        this.pieChart = null;
        this.dailyChart = null;
        this.init();
        window.addEventListener('qpro:simulation-snapshot', (event) => this.renderSimulationSnapshot(event.detail));
    }

    init() {
        this.setupRangeToggle();
    }

    setupRangeToggle() {
        document.querySelectorAll('.analytics-range-toggle .chart-period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.analytics-range-toggle .chart-period-btn')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.range = btn.dataset.range;
                this.refresh();
            });
        });
    }

    getDateRange() {
        const today = new Date().toISOString().split('T')[0];
        if (this.range === 'today') return { from: today, to: today };

        const days = parseInt(this.range) || 7;
        const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];
        return { from, to: today };
    }

    async refresh() {
        const { from, to } = this.getDateRange();
        try {
            const res = await fetch(`api/analytics?from=${from}&to=${to}`);
            this.data = await res.json();
            this.renderSummary();
            this.renderMaterialPie();
            this.renderDailyChart();
            this.renderZoneBreakdown();
            this.renderVehicleTable();
            this.renderFuelCost();
        } catch (e) {
            console.error('Analytics load error:', e);
        }
    }

    fmt(n, dp = 0) {
        return parseFloat(n || 0).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    }

    renderSummary() {
        const d = this.data;
        const label = this.range === 'today' ? 'Today' : `Last ${this.range} days`;
        const s = d.summary;
        const avgPerDay = s.active_days > 0 ? s.total_tonnes / s.active_days : 0;
        const totalCost = parseFloat(s.total_cost || 0);
        const costPerTonne = parseFloat(s.cost_per_tonne || 4.5);

        const el = document.getElementById('analytics-summary');
        if (!el) return;
        el.innerHTML = `
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(s.total_tonnes, 1)}<span class="analytics-kpi-unit">t</span></div>
                <div class="analytics-kpi-lbl">Total Production</div>
                <div class="analytics-kpi-sub">${label}</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(s.total_loads)}<span class="analytics-kpi-unit">loads</span></div>
                <div class="analytics-kpi-lbl">Total Loads</div>
                <div class="analytics-kpi-sub">Avg ${s.total_loads > 0 ? this.fmt(s.total_tonnes / s.total_loads, 1) : 0}t / load</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(avgPerDay, 0)}<span class="analytics-kpi-unit">t/day</span></div>
                <div class="analytics-kpi-lbl">Avg Daily Production</div>
                <div class="analytics-kpi-sub">${s.active_days} active day${s.active_days !== 1 ? 's' : ''}</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">£${this.fmt(totalCost, 0)}</div>
                <div class="analytics-kpi-lbl">Est. Revenue Value</div>
                <div class="analytics-kpi-sub">@ £${costPerTonne}/t</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(s.vehicles_used)}<span class="analytics-kpi-unit">vehicles</span></div>
                <div class="analytics-kpi-lbl">Vehicles Active</div>
                <div class="analytics-kpi-sub">${d.incidents} incident${d.incidents !== 1 ? 's' : ''} reported</div>
            </div>
        `;
    }

    renderSimulationSnapshot(snapshot) {
        const el = document.getElementById('analytics-summary');
        if (!el || !snapshot) return;
        el.innerHTML = `
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(snapshot.tonnesToday, 1)}<span class="analytics-kpi-unit">t</span></div>
                <div class="analytics-kpi-lbl">Live Production</div>
                <div class="analytics-kpi-sub">${this.fmt(snapshot.material.localSellableProduct, 1)}t local product</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(snapshot.soldTonnes, 1)}<span class="analytics-kpi-unit">t</span></div>
                <div class="analytics-kpi-lbl">Edge Sales</div>
                <div class="analytics-kpi-sub">£${this.fmt(snapshot.revenue, 0)} booked at edge piles</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(snapshot.cycles.crusherScreener)}</div>
                <div class="analytics-kpi-lbl">Plant Cycles</div>
                <div class="analytics-kpi-sub">${this.fmt(snapshot.cycles.edgeHaulLoads)} edge haul loads</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${this.fmt(snapshot.dust.index)}</div>
                <div class="analytics-kpi-lbl">Dust Index</div>
                <div class="analytics-kpi-sub">${this.fmt(snapshot.dust.suppressionLevel)}% suppression</div>
            </div>
            <div class="analytics-kpi-card">
                <div class="analytics-kpi-val">${snapshot.water.risk}</div>
                <div class="analytics-kpi-lbl">Water Table</div>
                <div class="analytics-kpi-sub">Lagoon ${snapshot.water.lagoonPercent}% · clearance ${snapshot.water.clearance}m</div>
            </div>
        `;
    }

    renderMaterialPie() {
        const materials = this.data.materials || [];
        const total = materials.reduce((s, m) => s + parseFloat(m.tonnes), 0);

        const COLOURS = [
            '#2f81f7', '#3fb950', '#d29922', '#f85149',
            '#a371f7', '#39d353', '#e3b341', '#f0883e',
            '#58a6ff', '#56d364'
        ];

        const canvas = document.getElementById('materialPieChart');
        if (!canvas) return;

        if (this.pieChart) { this.pieChart.destroy(); this.pieChart = null; }

        if (materials.length === 0) {
            canvas.parentElement.innerHTML = '<p class="empty-state" style="padding:32px;text-align:center;">No production data for this period</p>';
            document.getElementById('material-legend').innerHTML = '';
            return;
        }

        this.pieChart = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: materials.map(m => m.material_type || 'Unknown'),
                datasets: [{
                    data: materials.map(m => parseFloat(m.tonnes).toFixed(1)),
                    backgroundColor: COLOURS.slice(0, materials.length),
                    borderColor: 'var(--bg-primary)',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '62%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const val = parseFloat(ctx.raw);
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                                return ` ${val.toLocaleString('en-GB', { minimumFractionDigits: 1 })}t (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Custom legend
        const legend = document.getElementById('material-legend');
        if (legend) {
            legend.innerHTML = materials.map((m, i) => {
                const pct = total > 0 ? ((parseFloat(m.tonnes) / total) * 100).toFixed(1) : 0;
                return `<div class="analytics-legend-item">
                    <span class="analytics-legend-dot" style="background:${COLOURS[i % COLOURS.length]}"></span>
                    <span class="analytics-legend-name">${m.material_type || 'Unknown'}</span>
                    <span class="analytics-legend-val">${this.fmt(m.tonnes, 1)}t</span>
                    <span class="analytics-legend-pct">${pct}%</span>
                </div>`;
            }).join('');
        }
    }

    renderDailyChart() {
        const daily = this.data.daily || [];
        const canvas = document.getElementById('analyticsDailyChart');
        if (!canvas) return;

        if (this.dailyChart) { this.dailyChart.destroy(); this.dailyChart = null; }

        // Fill all days in range with zeros
        const { from, to } = this.getDateRange();
        const allDays = [];
        const cur = new Date(from + 'T12:00:00');
        const end = new Date(to + 'T12:00:00');
        while (cur <= end) {
            allDays.push(cur.toISOString().split('T')[0]);
            cur.setDate(cur.getDate() + 1);
        }

        const dataMap = {};
        daily.forEach(d => { dataMap[d.date] = d; });

        const labels = allDays.map(d => {
            const dt = new Date(d + 'T12:00:00');
            if (allDays.length <= 7) {
                return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
            }
            return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        });
        const tonnes = allDays.map(d => parseFloat((dataMap[d] || {}).tonnes || 0).toFixed(1));
        const loads = allDays.map(d => parseInt((dataMap[d] || {}).loads || 0));

        // Today highlighted
        const todayStr = new Date().toISOString().split('T')[0];
        const barColours = allDays.map(d => d === todayStr ? '#3fb950' : '#2f81f7');

        this.dailyChart = new Chart(canvas, {
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Tonnes',
                        data: tonnes,
                        backgroundColor: barColours,
                        borderRadius: 4,
                        yAxisID: 'y'
                    },
                    {
                        type: 'line',
                        label: 'Loads',
                        data: loads,
                        borderColor: '#d29922',
                        backgroundColor: 'transparent',
                        pointBackgroundColor: '#d29922',
                        pointRadius: 4,
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#8b949e', font: { size: 11 } }
                    }
                },
                scales: {
                    x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: {
                        type: 'linear', position: 'left',
                        ticks: { color: '#8b949e', font: { size: 11 } },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        title: { display: true, text: 'Tonnes', color: '#8b949e', font: { size: 11 } }
                    },
                    y1: {
                        type: 'linear', position: 'right',
                        ticks: { color: '#d29922', font: { size: 11 } },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Loads', color: '#d29922', font: { size: 11 } }
                    }
                }
            }
        });
    }

    renderZoneBreakdown() {
        const zones = this.data.zones || [];
        const el = document.getElementById('zone-breakdown');
        if (!el) return;

        if (zones.length === 0) {
            el.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;">No zone data for this period</p>';
            return;
        }

        const max = Math.max(...zones.map(z => parseFloat(z.tonnes)));
        el.innerHTML = zones.map(z => {
            const pct = max > 0 ? ((parseFloat(z.tonnes) / max) * 100).toFixed(1) : 0;
            return `<div class="analytics-zone-row">
                <div class="analytics-zone-label">
                    <span class="analytics-zone-name">${z.zone || 'Unspecified'}</span>
                    <span class="analytics-zone-stats">${this.fmt(z.tonnes, 1)}t · ${z.loads} loads</span>
                </div>
                <div class="analytics-zone-bar-track">
                    <div class="analytics-zone-bar-fill" style="width:${pct}%"></div>
                </div>
            </div>`;
        }).join('');
    }

    renderVehicleTable() {
        const vehicles = this.data.vehicles || [];
        const el = document.getElementById('vehicle-perf-table');
        if (!el) return;

        if (vehicles.length === 0) {
            el.innerHTML = '<p class="empty-state" style="padding:20px;text-align:center;">No vehicle data for this period</p>';
            return;
        }

        const maxTonnes = Math.max(...vehicles.map(v => parseFloat(v.tonnes)));
        el.innerHTML = `
            <table class="analytics-table">
                <thead>
                    <tr>
                        <th>Vehicle</th>
                        <th>Type</th>
                        <th class="right">Loads</th>
                        <th class="right">Total (t)</th>
                        <th class="right">Avg Load (t)</th>
                        <th>Contribution</th>
                    </tr>
                </thead>
                <tbody>
                    ${vehicles.map((v, i) => {
                        const pct = maxTonnes > 0 ? ((parseFloat(v.tonnes) / maxTonnes) * 100).toFixed(1) : 0;
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                        return `<tr>
                            <td>${medal} ${v.name}</td>
                            <td class="muted">${v.type}</td>
                            <td class="right">${v.loads}</td>
                            <td class="right"><strong>${this.fmt(v.tonnes, 1)}</strong></td>
                            <td class="right">${this.fmt(v.avg_load_size, 2)}</td>
                            <td>
                                <div class="mini-bar-track">
                                    <div class="mini-bar-fill" style="width:${pct}%"></div>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderFuelCost() {
        const f = this.data.fuel || {};
        const s = this.data.summary || {};
        const fuelCost = parseFloat(f.total_fuel_cost || 0);
        const prodCost = parseFloat(s.total_cost || 0);
        const totalCost = prodCost + fuelCost;
        const litres = parseFloat(f.total_litres || 0);
        const tonnes = parseFloat(s.total_tonnes || 0);
        const costPerTonne = tonnes > 0 ? (totalCost / tonnes) : 0;

        const el = document.getElementById('fuel-cost-summary');
        if (!el) return;

        el.innerHTML = `
            <div class="fuel-cost-grid">
                <div class="fuel-cost-card">
                    <div class="fuel-cost-icon">⛽</div>
                    <div class="fuel-cost-val">${this.fmt(litres, 0)}<span class="fuel-cost-unit">L</span></div>
                    <div class="fuel-cost-lbl">Total Diesel</div>
                    <div class="fuel-cost-sub">${f.refuel_count || 0} refuel event${f.refuel_count !== 1 ? 's' : ''}</div>
                </div>
                <div class="fuel-cost-card">
                    <div class="fuel-cost-icon">💷</div>
                    <div class="fuel-cost-val">£${this.fmt(fuelCost, 2)}</div>
                    <div class="fuel-cost-lbl">Fuel Cost</div>
                    <div class="fuel-cost-sub">${litres > 0 ? '£' + this.fmt(fuelCost / litres, 2) + '/L avg' : 'No refuels logged'}</div>
                </div>
                <div class="fuel-cost-card">
                    <div class="fuel-cost-icon">📊</div>
                    <div class="fuel-cost-val">£${this.fmt(prodCost, 0)}</div>
                    <div class="fuel-cost-lbl">Production Value</div>
                    <div class="fuel-cost-sub">@ £${this.fmt(s.cost_per_tonne, 2)}/t</div>
                </div>
                <div class="fuel-cost-card highlight">
                    <div class="fuel-cost-icon">🎯</div>
                    <div class="fuel-cost-val">£${this.fmt(costPerTonne, 2)}</div>
                    <div class="fuel-cost-lbl">Total Cost / Tonne</div>
                    <div class="fuel-cost-sub">Fuel + Production</div>
                </div>
            </div>
        `;
    }
}

window.analyticsManager = new AnalyticsManager();
