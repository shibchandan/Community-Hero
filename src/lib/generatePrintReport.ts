/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Issue, User } from '../types';

interface PredictiveRisk {
  id: string;
  zone: string;
  hazardType: string;
  probability: number;
  factors: string[];
  recommendedAction: string;
}

interface ReportData {
  issues: Issue[];
  usersList: User[];
  predictiveRisks: PredictiveRisk[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function riskColor(p: number) {
  if (p >= 80) return '#f43f5e';
  if (p >= 60) return '#f59e0b';
  return '#06b6d4';
}

function riskLabel(p: number) {
  if (p >= 80) return '🔴 Critical';
  if (p >= 60) return '🟠 High Risk';
  return '🟡 Medium';
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    road: '🚧 Road Damage',
    garbage: '🚮 Waste Overflow',
    water: '💧 Water Leak',
    streetlight: '💡 Streetlight',
    safety: '🚨 Public Safety',
  };
  return map[cat] ?? cat;
}

// ── Report Generator ─────────────────────────────────────────────────────────

export function generatePrintReport({ issues, usersList, predictiveRisks }: ReportData) {
  const now = new Date();
  const timestamp = now.toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const total = issues.length;
  const resolved = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  const active = total - resolved;
  const escalated = issues.filter(i => i.escalated && i.status !== 'closed').length;
  const resolutionRate = pct(resolved, total);

  const departments = [
    { name: 'Roads & Asphalt',     cat: 'road' },
    { name: 'Sanitary & Trash',    cat: 'garbage' },
    { name: 'Water & Plumbing',    cat: 'water' },
    { name: 'Electricity Board',   cat: 'streetlight' },
    { name: 'Public Safety Dept',  cat: 'safety' },
  ].map(d => {
    const all = issues.filter(i => i.category === d.cat);
    const res = all.filter(i => i.status === 'resolved' || i.status === 'closed');
    return { ...d, total: all.length, resolved: res.length, rate: pct(res.length, all.length) };
  });

  const maxDeptTotal = Math.max(...departments.map(d => d.total), 1);

  const totalPoints = usersList.reduce((s, u) => s + (u.points || 0), 0);
  const avgPoints = usersList.length > 0 ? Math.round(totalPoints / usersList.length) : 0;
  const topUsers = [...usersList].sort((a, b) => b.points - a.points).slice(0, 5);

  const escIssues = issues
    .filter(i => i.escalated && i.status !== 'closed')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 5);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Civic Intelligence Engine — SLA Report ${now.toLocaleDateString('en-IN')}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #fff;
      color: #1e293b;
      font-size: 12px;
      line-height: 1.5;
    }

    /* ── Cover Page ────────────────────────────────────────────── */
    .cover {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
      color: white;
      text-align: center;
      padding: 48px;
      page-break-after: always;
    }
    .cover-logo {
      font-size: 48px;
      margin-bottom: 24px;
    }
    .cover h1 {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: -1px;
      background: linear-gradient(135deg, #818cf8, #38bdf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .cover h2 {
      font-size: 16px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 48px;
    }
    .cover-meta {
      display: flex;
      gap: 32px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .cover-meta-item {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px 24px;
      text-align: center;
    }
    .cover-meta-item .val {
      font-size: 32px;
      font-weight: 900;
      font-family: 'JetBrains Mono', monospace;
      color: #818cf8;
    }
    .cover-meta-item .lbl {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .cover-timestamp {
      position: absolute;
      bottom: 32px;
      font-size: 10px;
      color: #475569;
    }

    /* ── Page Layout ───────────────────────────────────────────── */
    .page {
      padding: 40px 48px;
      max-width: 900px;
      margin: 0 auto;
      page-break-after: always;
    }
    .page:last-child { page-break-after: avoid; }

    /* ── Section Header ────────────────────────────────────────── */
    .section-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e2e8f0;
    }
    .section-header h2 {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .section-header .badge {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 3px 8px;
      border-radius: 6px;
      background: #e0e7ff;
      color: #4338ca;
    }

    /* ── KPI Cards ─────────────────────────────────────────────── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    .kpi-card {
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .kpi-card .val {
      font-size: 28px;
      font-weight: 900;
      font-family: 'JetBrains Mono', monospace;
    }
    .kpi-card .lbl {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-top: 2px;
    }

    /* ── Bar Chart ─────────────────────────────────────────────── */
    .dept-row { margin-bottom: 14px; }
    .dept-row .top { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; margin-bottom: 4px; }
    .dept-row .bar-bg { width: 100%; height: 10px; border-radius: 5px; background: #e2e8f0; overflow: hidden; }
    .dept-row .bar-fill { height: 100%; border-radius: 5px; background: linear-gradient(90deg, #4f46e5, #818cf8); }
    .dept-row .meta { font-size: 9px; color: #64748b; margin-top: 3px; }

    /* ── Risk Cards ─────────────────────────────────────────────── */
    .risk-card {
      padding: 14px 16px;
      border-radius: 10px;
      border-left: 4px solid;
      background: #f8fafc;
      border-color: #e2e8f0;
      margin-bottom: 12px;
    }
    .risk-card .risk-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .risk-card .risk-zone { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
    .risk-card .risk-title { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .risk-card .risk-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
    .risk-card .prob-bar-bg { width: 100%; height: 6px; border-radius: 3px; background: #e2e8f0; overflow: hidden; margin: 8px 0; }
    .risk-card .prob-bar { height: 100%; border-radius: 3px; }
    .risk-card .factors { font-size: 10px; color: #475569; line-height: 1.6; }
    .risk-card .action { font-size: 10px; font-weight: 600; margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #e0e7ff; color: #3730a3; }

    /* ── Escalated Table ────────────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f1f5f9; font-weight: 700; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; color: #475569; }
    td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .badge-red    { display:inline-block; padding: 2px 7px; border-radius: 5px; font-size: 9px; font-weight: 700; background: #fee2e2; color: #b91c1c; }
    .badge-amber  { display:inline-block; padding: 2px 7px; border-radius: 5px; font-size: 9px; font-weight: 700; background: #fef3c7; color: #92400e; }
    .badge-indigo { display:inline-block; padding: 2px 7px; border-radius: 5px; font-size: 9px; font-weight: 700; background: #e0e7ff; color: #3730a3; }

    /* ── Footer ─────────────────────────────────────────────────── */
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }

    /* ── Print ──────────────────────────────────────────────────── */
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- ══ COVER PAGE ════════════════════════════════════════════════════════ -->
  <div class="cover">
    <div class="cover-logo">🏙️</div>
    <h1>Civic Intelligence Engine</h1>
    <h2>Municipal SLA Performance & Predictive Risk Report</h2>

    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="val">${total}</div>
        <div class="lbl">Total Reports</div>
      </div>
      <div class="cover-meta-item">
        <div class="val" style="color:#34d399">${resolutionRate}%</div>
        <div class="lbl">Resolution Rate</div>
      </div>
      <div class="cover-meta-item">
        <div class="val" style="color:#fb923c">${active}</div>
        <div class="lbl">Active Backlog</div>
      </div>
      <div class="cover-meta-item">
        <div class="val" style="color:#f43f5e">${escalated}</div>
        <div class="lbl">SLA Breaches</div>
      </div>
    </div>

    <div class="cover-timestamp">Generated: ${timestamp} · Confidential Municipal Document</div>
  </div>

  <!-- ══ PAGE 1: KPI + DEPARTMENT SLA ══════════════════════════════════════ -->
  <div class="page">
    <div class="section-header">
      <span>📊</span>
      <h2>Executive KPI Summary</h2>
      <span class="badge">Section 1</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="val" style="color:#4f46e5">${total}</div>
        <div class="lbl">Total Reports Filed</div>
      </div>
      <div class="kpi-card">
        <div class="val" style="color:#10b981">${resolutionRate}%</div>
        <div class="lbl">Resolution Rate</div>
      </div>
      <div class="kpi-card">
        <div class="val" style="color:#f59e0b">${active}</div>
        <div class="lbl">Active Backlog</div>
      </div>
      <div class="kpi-card">
        <div class="val" style="color:#f43f5e">${escalated}</div>
        <div class="lbl">SLA Breaches</div>
      </div>
    </div>

    <div class="section-header" style="margin-top:28px">
      <span>🏢</span>
      <h2>Departmental SLA Load Factor</h2>
      <span class="badge">Load Analysis</span>
    </div>

    ${departments.map(d => `
    <div class="dept-row">
      <div class="top">
        <span>${d.name}</span>
        <span style="font-family:monospace;color:#4f46e5;font-weight:800">${d.resolved} resolved / ${d.total} logged &nbsp;·&nbsp; ${d.rate}% rate</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width:${(d.total / maxDeptTotal) * 100}%"></div>
      </div>
    </div>`).join('')}

    <div class="footer">
      <span>Civic Intelligence Engine — Confidential</span>
      <span>Page 1 of 3 · ${timestamp}</span>
    </div>
  </div>

  <!-- ══ PAGE 2: PREDICTIVE RISKS + ESCALATED ═══════════════════════════════ -->
  <div class="page">
    <div class="section-header">
      <span>🤖</span>
      <h2>AI Predictive Risk Intelligence</h2>
      <span class="badge">Section 2</span>
    </div>

    ${predictiveRisks.length === 0
      ? `<p style="color:#94a3b8;font-style:italic;text-align:center;padding:24px">No predictive risk signals detected at this time.</p>`
      : predictiveRisks.map(r => `
    <div class="risk-card" style="border-left-color:${riskColor(r.probability)}">
      <div class="risk-top">
        <div>
          <div class="risk-zone">📍 ${r.zone}</div>
          <div class="risk-title">${r.hazardType}</div>
        </div>
        <span class="risk-badge" style="background:${riskColor(r.probability)}22;color:${riskColor(r.probability)}">${riskLabel(r.probability)} · ${r.probability}%</span>
      </div>
      <div class="prob-bar-bg"><div class="prob-bar" style="width:${r.probability}%;background:${riskColor(r.probability)}"></div></div>
      <div class="factors"><strong>Contributing Factors:</strong> ${r.factors.join(' · ')}</div>
      <div class="action">⚡ Proactive Action: ${r.recommendedAction}</div>
    </div>`).join('')}

    <div class="section-header" style="margin-top:28px">
      <span>🚨</span>
      <h2>Active SLA Breach Registry</h2>
      <span class="badge">Escalated Issues</span>
    </div>

    ${escIssues.length === 0
      ? `<p style="color:#94a3b8;font-style:italic;text-align:center;padding:24px">No active SLA breaches. All issues within target timelines.</p>`
      : `<table>
        <thead>
          <tr>
            <th>Issue</th>
            <th>Category</th>
            <th>Severity</th>
            <th>Location</th>
            <th>SLA Status</th>
          </tr>
        </thead>
        <tbody>
          ${escIssues.map(i => {
            const ageDays = Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 86400000);
            const overdue = ageDays - i.slaDays;
            return `<tr>
              <td><strong>${i.title}</strong></td>
              <td>${categoryLabel(i.category)}</td>
              <td><span class="badge-${i.severity === 'high' ? 'red' : i.severity === 'medium' ? 'amber' : 'indigo'}">${i.severity}</span></td>
              <td>${i.location.area}</td>
              <td><span class="badge-red">Overdue ${overdue}d</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`}

    <div class="footer">
      <span>Civic Intelligence Engine — Confidential</span>
      <span>Page 2 of 3 · ${timestamp}</span>
    </div>
  </div>

  <!-- ══ PAGE 3: CITIZEN GAMIFICATION ════════════════════════════════════════ -->
  <div class="page">
    <div class="section-header">
      <span>🏆</span>
      <h2>Civic Gamification & Participation Analytics</h2>
      <span class="badge">Section 3</span>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card">
        <div class="val" style="color:#f59e0b">${totalPoints}</div>
        <div class="lbl">Total Points Distributed</div>
      </div>
      <div class="kpi-card">
        <div class="val" style="color:#4f46e5">${usersList.length}</div>
        <div class="lbl">Registered Citizens</div>
      </div>
      <div class="kpi-card">
        <div class="val" style="color:#10b981">${avgPoints}</div>
        <div class="lbl">Avg Points / Citizen</div>
      </div>
    </div>

    <div class="section-header" style="margin-top:28px">
      <span>🥇</span>
      <h2>Top Civic Heroes Leaderboard</h2>
    </div>

    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Citizen</th>
          <th>Area</th>
          <th>Points</th>
          <th>Trust Score</th>
          <th>Badges</th>
        </tr>
      </thead>
      <tbody>
        ${topUsers.map((u, idx) => `<tr>
          <td><strong>${['🥇','🥈','🥉','4th','5th'][idx]}</strong></td>
          <td><strong>${u.name}</strong></td>
          <td>${u.area}</td>
          <td><span style="font-family:monospace;font-weight:800;color:#4f46e5">${u.points} pts</span></td>
          <td>${u.trust_score}%</td>
          <td>${u.badges.length} earned</td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div style="margin-top:28px;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
      <h4 style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:12px">📌 Rank Distribution</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center">
        ${[
          { emoji: '👑', name: 'District Guardian', min: 400, max: Infinity },
          { emoji: '🏅', name: 'Ambassador', min: 250, max: 399 },
          { emoji: '🕵️', name: 'Vigilante', min: 100, max: 249 },
          { emoji: '🌱', name: 'Civic Rookie', min: 0, max: 99 },
        ].map(r => {
          const count = usersList.filter(u => u.points >= r.min && u.points <= r.max).length;
          return `<div>
            <div style="font-size:24px">${r.emoji}</div>
            <div style="font-weight:800;font-size:18px;font-family:monospace;color:#4f46e5">${count}</div>
            <div style="font-size:9px;color:#64748b;font-weight:700;text-transform:uppercase">${r.name}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="footer">
      <span>Civic Intelligence Engine — Confidential Municipal Document</span>
      <span>Page 3 of 3 · ${timestamp}</span>
    </div>
  </div>

  <script>
    window.onload = () => {
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    alert('Pop-up blocked! Please allow pop-ups for this site and try again.');
  }
}
