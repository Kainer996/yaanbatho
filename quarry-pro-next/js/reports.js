// QuarryPro - Reports v2.0

class ReportsManager {
    constructor() {
        this.currentReport = null;
        this.setupEventListeners();

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reportDate').value = today;
        this.loadReport(today);
    }

    setupEventListeners() {
        document.getElementById('loadReport').addEventListener('click', () => {
            const date = document.getElementById('reportDate').value;
            this.loadReport(date);
        });

        document.getElementById('exportReport').addEventListener('click', () => {
            this.printReport();
        });

        const csvBtn = document.getElementById('exportCsv');
        if (csvBtn) {
            csvBtn.addEventListener('click', () => {
                const date = document.getElementById('reportDate').value;
                window.open(`api/production/csv?date=${date}`, '_blank');
            });
        }
    }

    async loadReport(date) {
        try {
            const response = await fetch(`api/report/daily?date=${date}`);
            this.currentReport = await response.json();
            this.renderReport(this.currentReport);
        } catch (error) {
            console.error('Failed to load report:', error);
        }
    }

    renderReport(report) {
        const container = document.getElementById('reportContent');

        const reportDate = new Date(report.date + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const targetPctNum = parseFloat(report.target_pct);
        const targetColor = targetPctNum >= 100 ? 'var(--accent-green)' : targetPctNum >= 75 ? 'var(--accent-yellow)' : 'var(--accent-red)';

        container.innerHTML = `
            <div class="report-section">
                <h3>📋 Daily Production Report — ${reportDate}</h3>
                <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">Site: ${window.settingsManager?.settings?.site_name || 'Bankfield Quarry'}</div>
            </div>

            <div class="report-section">
                <h3>Summary</h3>
                <div class="production-stats">
                    <div class="stat-card">
                        <h3>Total Production</h3>
                        <div class="stat-value">${parseFloat(report.summary.total_tonnes).toFixed(1)} t</div>
                    </div>
                    <div class="stat-card">
                        <h3>Total Loads</h3>
                        <div class="stat-value">${report.summary.total_loads}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Avg Load</h3>
                        <div class="stat-value">
                            ${report.summary.total_loads > 0 ? (report.summary.total_tonnes / report.summary.total_loads).toFixed(1) : 0} t
                        </div>
                    </div>
                </div>
                <div style="margin-top:12px;padding:12px;background:var(--bg-tertiary);border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span>Daily Target Progress</span>
                        <span style="color:${targetColor};font-weight:600;">${report.target_pct}% of ${report.daily_target}t target</span>
                    </div>
                    <div class="target-bar-track">
                        <div class="target-bar-fill" style="width:${Math.min(100, targetPctNum)}%;background:${targetColor};"></div>
                    </div>
                </div>
                <div style="margin-top:8px;font-size:13px;color:var(--text-secondary);">
                    💷 Est. operating cost: <strong>£${report.estimated_cost}</strong> @ £${report.cost_per_tonne}/t
                    &nbsp;|&nbsp; 👷 Workers on duty: <strong>${report.workers_on_duty}</strong>
                    &nbsp;|&nbsp; ⚠️ Incidents today: <strong>${report.incidents}</strong>
                </div>
            </div>

            ${report.materialBreakdown && report.materialBreakdown.length > 0 ? `
            <div class="report-section">
                <h3>Material Breakdown</h3>
                <table class="report-table">
                    <thead><tr><th>Material</th><th>Loads</th><th>Tonnes</th><th>%</th></tr></thead>
                    <tbody>
                        ${report.materialBreakdown.map(m => {
                            const pct = report.summary.total_tonnes > 0 ? (m.tonnes / report.summary.total_tonnes * 100).toFixed(1) : 0;
                            return `<tr>
                                <td>${m.material_type || 'unknown'}</td>
                                <td>${m.loads}</td>
                                <td>${parseFloat(m.tonnes).toFixed(1)} t</td>
                                <td>${pct}%</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>` : ''}

            <div class="report-section">
                <h3>Vehicle Performance</h3>
                ${report.production.length > 0 ? `
                    <table class="report-table">
                        <thead>
                            <tr><th>Vehicle</th><th>Type</th><th>Loads</th><th>Total Tonnes</th><th>Avg Load</th></tr>
                        </thead>
                        <tbody>
                            ${report.production.map(p => `
                                <tr>
                                    <td>${p.name}</td>
                                    <td>${p.type}</td>
                                    <td>${p.loads}</td>
                                    <td>${parseFloat(p.total_tonnes).toFixed(1)} t</td>
                                    <td>${(p.total_tonnes / p.loads).toFixed(1)} t</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                ` : '<p class="info-text">No production logged for this date.</p>'}
            </div>
        `;
    }

    printReport() {
        if (!this.currentReport) { alert('No report loaded.'); return; }

        const siteName = window.settingsManager?.settings?.site_name || 'Bankfield Quarry';
        const date = this.currentReport.date;
        const r = this.currentReport;

        const printHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>QuarryPro Report — ${date}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 30px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin:10px 0; }
  .stat { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px; text-align:center; }
  .stat-val { font-size: 20px; font-weight: 700; }
  .stat-lbl { font-size: 11px; color: #666; }
  .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
  @media print { body { margin: 15mm; } }
</style>
</head><body>
<h1>📋 QuarryPro Daily Report</h1>
<p><strong>${siteName}</strong> — ${new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>

<h2>Production Summary</h2>
<div class="summary-grid">
  <div class="stat"><div class="stat-val">${parseFloat(r.summary.total_tonnes).toFixed(1)}t</div><div class="stat-lbl">Total Tonnes</div></div>
  <div class="stat"><div class="stat-val">${r.summary.total_loads}</div><div class="stat-lbl">Loads</div></div>
  <div class="stat"><div class="stat-val">${r.summary.total_loads > 0 ? (r.summary.total_tonnes / r.summary.total_loads).toFixed(1) : 0}t</div><div class="stat-lbl">Avg Load</div></div>
</div>
<p>Daily target: <strong>${r.target_pct}%</strong> of ${r.daily_target}t &nbsp;|&nbsp; Est. cost: <strong>£${r.estimated_cost}</strong> @ £${r.cost_per_tonne}/t &nbsp;|&nbsp; Workers: <strong>${r.workers_on_duty}</strong> &nbsp;|&nbsp; Incidents: <strong>${r.incidents}</strong></p>

${r.materialBreakdown && r.materialBreakdown.length > 0 ? `
<h2>Material Breakdown</h2>
<table>
  <thead><tr><th>Material</th><th>Loads</th><th>Tonnes</th><th>%</th></tr></thead>
  <tbody>${r.materialBreakdown.map(m => {
    const pct = r.summary.total_tonnes > 0 ? (m.tonnes / r.summary.total_tonnes * 100).toFixed(1) : 0;
    return `<tr><td>${m.material_type||'unknown'}</td><td>${m.loads}</td><td>${parseFloat(m.tonnes).toFixed(1)}t</td><td>${pct}%</td></tr>`;
  }).join('')}</tbody>
</table>` : ''}

${r.production.length > 0 ? `
<h2>Vehicle Performance</h2>
<table>
  <thead><tr><th>Vehicle</th><th>Type</th><th>Loads</th><th>Total Tonnes</th><th>Avg Load</th></tr></thead>
  <tbody>${r.production.map(p => `<tr><td>${p.name}</td><td>${p.type}</td><td>${p.loads}</td><td>${parseFloat(p.total_tonnes).toFixed(1)}t</td><td>${(p.total_tonnes/p.loads).toFixed(1)}t</td></tr>`).join('')}</tbody>
</table>` : '<p>No vehicle production data for this date.</p>'}

<div class="footer">Generated by QuarryPro — ${new Date().toLocaleString('en-GB')} &nbsp;|&nbsp; Confidential</div>
</body></html>`;

        const win = window.open('', '_blank');
        win.document.write(printHtml);
        win.document.close();
        win.print();
    }
}

let reportsManager;
document.addEventListener('DOMContentLoaded', () => {
    reportsManager = new ReportsManager();
});
