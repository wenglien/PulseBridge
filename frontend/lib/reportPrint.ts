import type { AnalysisResult } from "@/types/analysis"
import type { HealthData } from "@/types/health"

const riskLabelZh: Record<string, string> = {
  low: "低風險",
  medium: "中等風險",
  high: "高風險",
  critical: "需立即就醫",
}
const riskLabelEn: Record<string, string> = {
  low: "Low Risk",
  medium: "Moderate Risk",
  high: "High Risk",
  critical: "Critical - Seek Care",
}
const riskColor: Record<string, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626",
}
const followUpZh: Record<string, string> = {
  immediate: "立即就醫",
  "1_week": "一週內追蹤",
  "2_weeks": "兩週內追蹤",
  routine: "例行追蹤",
}
const categoryZh: Record<string, string> = {
  diet: "飲食調養",
  lifestyle: "生活習慣",
  exercise: "運動建議",
  tcm_herbs: "中藥調理",
  acupressure: "穴位保健",
  emotional: "情緒管理",
}

function fmt(n: number | undefined, unit = "", decimals = 1) {
  if (!n || n === 0) return "—"
  return `${n.toFixed(decimals)}${unit}`
}

export function printReport(
  result: AnalysisResult,
  health: HealthData | null,
  sessionId: string,
  generatedAt: string,
) {
  const risk = result.executive_summary.overall_risk_level
  const color = riskColor[risk] ?? "#6b7280"
  const hrv = health?.hrv
  const sleep = health?.sleep ?? []
  const ecg = health?.ecg_readings ?? []

  // ECG classification summary
  const ecgCounts: Record<string, number> = {}
  for (const r of ecg) {
    ecgCounts[r.classification] = (ecgCounts[r.classification] ?? 0) + 1
  }

  // Sleep averages
  const avgSleep = sleep.length
    ? sleep.reduce((a, s) => a + s.total_sleep_minutes, 0) / sleep.length
    : 0
  const avgDeep = sleep.length
    ? sleep.reduce((a, s) => a + s.deep_sleep_minutes, 0) / sleep.length
    : 0
  const avgRem = sleep.length
    ? sleep.reduce((a, s) => a + s.rem_sleep_minutes, 0) / sleep.length
    : 0
  const avgEff = sleep.length
    ? sleep.reduce((a, s) => a + s.sleep_efficiency, 0) / sleep.length
    : 0

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <title>PulseBridge 健康分析報告 — ${sessionId.slice(0, 12)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }

    /* ── Print settings ── */
    @page {
      size: A4;
      margin: 15mm 14mm 15mm 14mm;
    }
    @media print {
      .no-print { display: none !important; }
      section { page-break-inside: avoid; }
    }

    /* ── Layout ── */
    .page { max-width: 740px; margin: 0 auto; padding: 20px; }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2.5px solid #0D7A66;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand { display: flex; flex-direction: column; gap: 2px; }
    .brand-name { font-size: 20pt; font-weight: 700; color: #0D7A66; letter-spacing: -0.5px; }
    .brand-sub { font-size: 8pt; color: #6b7280; letter-spacing: 0.5px; }
    .report-meta { text-align: right; }
    .report-meta p { font-size: 8pt; color: #6b7280; line-height: 1.6; }

    /* ── Risk badge ── */
    .risk-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 999px;
      font-size: 11pt;
      font-weight: 700;
      color: ${color};
      background: ${color}18;
      border: 1.5px solid ${color}50;
      margin-bottom: 12px;
    }
    .risk-dot { width: 8px; height: 8px; border-radius: 50%; background: ${color}; }

    /* ── Section ── */
    section { margin-bottom: 18px; }
    .section-title {
      font-size: 9pt;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }

    /* ── Summary card ── */
    .summary-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .headline { font-size: 13pt; font-weight: 700; color: #111827; margin-bottom: 8px; }
    .findings { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .finding-chip {
      font-size: 8pt;
      padding: 3px 10px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid #d1d5db;
      color: #374151;
    }
    .summary-text { font-size: 9.5pt; color: #374151; line-height: 1.7; }

    /* ── Metrics grid ── */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .metric-tile {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .metric-label { font-size: 7.5pt; color: #9ca3af; margin-bottom: 3px; }
    .metric-value { font-size: 13pt; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
    .metric-unit { font-size: 7.5pt; font-weight: 400; color: #6b7280; margin-left: 2px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th {
      background: #f3f4f6;
      color: #374151;
      font-weight: 600;
      text-align: left;
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      font-size: 8.5pt;
    }
    td {
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      color: #374151;
      vertical-align: top;
      line-height: 1.5;
    }
    tr:nth-child(even) td { background: #f9fafb; }

    /* ── Risk alerts ── */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 6px;
      border: 1px solid;
    }
    .alert.low    { background: #f0fdf4; border-color: #bbf7d0; }
    .alert.medium { background: #fffbeb; border-color: #fde68a; }
    .alert.high   { background: #fff7ed; border-color: #fed7aa; }
    .alert.critical { background: #fef2f2; border-color: #fecaca; }
    .alert-level {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 1px 7px;
      border-radius: 999px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .alert.low .alert-level    { background: #dcfce7; color: #15803d; }
    .alert.medium .alert-level { background: #fef9c3; color: #a16207; }
    .alert.high .alert-level   { background: #ffedd5; color: #c2410c; }
    .alert.critical .alert-level { background: #fee2e2; color: #b91c1c; }
    .alert-title { font-size: 9pt; font-weight: 600; color: #111827; }
    .alert-desc  { font-size: 8.5pt; color: #6b7280; margin-top: 2px; line-height: 1.5; }

    /* ── Recommendations ── */
    .rec {
      display: flex;
      gap: 10px;
      padding: 9px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .rec:last-child { border-bottom: none; }
    .rec-cat {
      flex-shrink: 0;
      font-size: 7.5pt;
      font-weight: 600;
      color: #0D7A66;
      background: #E8F5F2;
      border-radius: 5px;
      padding: 2px 7px;
      height: fit-content;
      margin-top: 1px;
      white-space: nowrap;
    }
    .rec-title { font-size: 9pt; font-weight: 600; color: #111827; margin-bottom: 3px; }
    .rec-body  { font-size: 8.5pt; color: #6b7280; line-height: 1.6; }

    /* ── Footer ── */
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer p { font-size: 7.5pt; color: #9ca3af; line-height: 1.6; }
    .disclaimer {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 14px;
      margin-top: 12px;
      font-size: 8pt;
      color: #92400e;
      line-height: 1.6;
    }

    /* ── Print button (no-print) ── */
    .print-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      background: #0D7A66;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      z-index: 100;
      gap: 12px;
    }
    .print-bar p { font-size: 9pt; opacity: 0.9; }
    .print-btn {
      background: white;
      color: #0D7A66;
      border: none;
      border-radius: 8px;
      padding: 7px 20px;
      font-size: 9.5pt;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }
    .close-btn {
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 8px;
      padding: 7px 14px;
      font-size: 9.5pt;
      cursor: pointer;
      flex-shrink: 0;
    }
    body { padding-top: 52px; }
    @media print { body { padding-top: 0; } }
  </style>
</head>
<body>

<!-- Print bar (hidden on print) -->
<div class="print-bar no-print">
  <p>💡 點擊「列印 / 儲存 PDF」→ 選擇「另存為 PDF」即可下載</p>
  <div style="display:flex;gap:8px">
    <button class="close-btn" onclick="window.close()">關閉</button>
    <button class="print-btn" onclick="window.print()">🖨 列印 / 儲存 PDF</button>
  </div>
</div>

<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">PulseBridge</div>
      <div class="brand-sub">中西醫整合 · AI 個人化健康分析報告</div>
    </div>
    <div class="report-meta">
      <p>報告日期 / Report Date: ${generatedAt}</p>
      <p>會話編號 / Session ID: ${sessionId.slice(0, 16)}…</p>
      <p>分析時間: ${result.analyzed_at ? new Date(result.analyzed_at).toLocaleString("zh-TW") : "—"}</p>
    </div>
  </div>

  <!-- Risk level -->
  <div class="risk-badge">
    <div class="risk-dot"></div>
    整體風險：${riskLabelZh[risk] ?? risk} &nbsp;/&nbsp; ${riskLabelEn[risk] ?? risk}
  </div>

  <!-- Executive Summary -->
  <section>
    <div class="section-title">整體摘要 / Executive Summary</div>
    <div class="summary-card">
      <div class="headline">${result.executive_summary.headline_zh}</div>
      <div class="findings">
        ${result.executive_summary.key_findings.map((f) => `<span class="finding-chip">${f}</span>`).join("")}
      </div>
      ${result.claude_summary_zh ? `<div class="summary-text">${result.claude_summary_zh}</div>` : ""}
      ${result.claude_summary_en ? `<div class="summary-text" style="margin-top:8px;color:#6b7280;font-size:8.5pt">${result.claude_summary_en}</div>` : ""}
    </div>
  </section>

  <!-- HRV Metrics -->
  ${hrv && hrv.sdnn > 0 ? `
  <section>
    <div class="section-title">心率變異性（HRV）/ Heart Rate Variability</div>
    <div class="metrics-grid">
      <div class="metric-tile">
        <div class="metric-label">SDNN</div>
        <div class="metric-value">${fmt(hrv.sdnn)}<span class="metric-unit">ms</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">RMSSD</div>
        <div class="metric-value">${fmt(hrv.rmssd)}<span class="metric-unit">ms</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">LF/HF 比值</div>
        <div class="metric-value">${fmt(hrv.lf_hf_ratio, "", 2)}</div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">pNN50</div>
        <div class="metric-value">${fmt(hrv.pnn50)}<span class="metric-unit">%</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">平均 RR 間期</div>
        <div class="metric-value">${fmt(hrv.mean_rr, "", 0)}<span class="metric-unit">ms</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">靜息心率</div>
        <div class="metric-value">${fmt(health?.resting_heart_rate, "", 0)}<span class="metric-unit">bpm</span></div>
      </div>
    </div>
  </section>
  ` : ""}

  <!-- ECG -->
  ${ecg.length > 0 ? `
  <section>
    <div class="section-title">心電圖（ECG）/ Electrocardiogram</div>
    <table>
      <thead>
        <tr>
          <th>分類 / Classification</th>
          <th>筆數 / Count</th>
          <th>比例 / Ratio</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(ecgCounts).map(([cls, cnt]) =>
          `<tr>
            <td>${cls}</td>
            <td>${cnt}</td>
            <td>${((cnt / ecg.length) * 100).toFixed(1)}%</td>
          </tr>`
        ).join("")}
      </tbody>
    </table>
  </section>
  ` : ""}

  <!-- Sleep -->
  ${sleep.length > 0 ? `
  <section>
    <div class="section-title">睡眠分析 / Sleep Analysis</div>
    <div class="metrics-grid">
      <div class="metric-tile">
        <div class="metric-label">平均睡眠時長</div>
        <div class="metric-value">${(avgSleep / 60).toFixed(1)}<span class="metric-unit">hr</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">深眠 Deep Sleep</div>
        <div class="metric-value">${(avgDeep / 60).toFixed(1)}<span class="metric-unit">hr</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">REM 睡眠</div>
        <div class="metric-value">${(avgRem / 60).toFixed(1)}<span class="metric-unit">hr</span></div>
      </div>
      <div class="metric-tile">
        <div class="metric-label">睡眠效率</div>
        <div class="metric-value">${(avgEff * 100).toFixed(0)}<span class="metric-unit">%</span></div>
      </div>
    </div>
  </section>
  ` : ""}

  <!-- Cardiac Assessment -->
  <section>
    <div class="section-title">整合心血管判讀 / Integrated Cardiac Assessment</div>
    <div class="summary-card">
      <p style="font-size:9.5pt;color:#111827;line-height:1.7;margin-bottom:8px">
        ${result.integrated_cardiac_assessment.primary_conclusion_zh}
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="font-size:8pt;padding:3px 10px;border-radius:999px;background:#f3f4f6;color:#374151;border:1px solid #e5e7eb">
          追蹤時程：${followUpZh[result.integrated_cardiac_assessment.follow_up_priority] ?? "—"}
        </span>
        ${result.integrated_cardiac_assessment.red_flags.map((f) =>
          `<span style="font-size:8pt;padding:3px 10px;border-radius:999px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca">${f}</span>`
        ).join("")}
      </div>
    </div>
  </section>

  <!-- Risk Alerts -->
  ${result.risk_alerts.length > 0 ? `
  <section>
    <div class="section-title">風險提醒 / Risk Alerts</div>
    ${result.risk_alerts.slice(0, 8).map((a) => `
      <div class="alert ${a.risk_level}">
        <span class="alert-level">${a.risk_level}</span>
        <div>
          <div class="alert-title">${a.title_zh}</div>
          ${a.description_zh ? `<div class="alert-desc">${a.description_zh}</div>` : ""}
        </div>
      </div>
    `).join("")}
  </section>
  ` : ""}

  <!-- Recommendations -->
  ${result.recommendations.length > 0 ? `
  <section>
    <div class="section-title">中醫視角調養建議 / TCM-Informed Recommendations</div>
    ${result.recommendations.map((r) => `
      <div class="rec">
        <div class="rec-cat">${categoryZh[r.category] ?? r.category}</div>
        <div>
          <div class="rec-title">${r.title_zh}</div>
          <div class="rec-body">${r.content_zh}</div>
        </div>
      </div>
    `).join("")}
  </section>
  ` : ""}

  <!-- Disclaimer -->
  <div class="disclaimer">
    ⚠️ 本報告由 AI 輔助生成，僅供健康參考，不構成醫療診斷。如有任何身體不適或報告顯示高風險，請儘速就醫諮詢專業醫師。<br />
    This report is AI-generated for informational purposes only and does not constitute medical advice or diagnosis.
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>
      <p>Generated by PulseBridge &nbsp;·&nbsp; 中西醫整合 AI 健康分析</p>
      <p>https://pulse-ai-d54fb.web.app</p>
    </div>
    <p style="text-align:right">報告生成於 ${generatedAt}</p>
  </div>

</div>
</body>
</html>`

  const win = window.open("", "_blank", "width=900,height=700")
  if (!win) {
    alert("請允許彈出視窗以開啟 PDF 報告")
    return
  }
  win.document.write(html)
  win.document.close()
}
