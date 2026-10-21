/**
 * One-page A4 summary for a clinic visit.
 *
 * Built for a doctor's 30-second read: what needs attention first, measured
 * numbers next to their reference ranges, then what the person reported.
 *
 * Security: every interpolated value is HTML-escaped (report text comes from
 * an LLM and from the user), and the document's CSP forbids all scripts. The
 * print/close buttons are wired from the opener instead of inline handlers.
 */
import type { AnalysisResult } from "@/types/analysis"
import type { HealthData } from "@/types/health"
import type { QuestionnaireResponse } from "@/types/questionnaire"
import { ECG_CLASSIFICATION_LABELS } from "@/lib/constants"
import { SYMPTOM_LABELS } from "@/lib/questionnaire"

const RISK_ZH: Record<string, string> = {
  low: "整體穩定", medium: "有幾項值得留意", high: "建議近期就醫檢查", critical: "請盡快就醫",
}
const FOLLOW_UP_ZH: Record<string, string> = {
  immediate: "立即就醫", "1_week": "一週內回診", "2_weeks": "兩週內追蹤", routine: "例行追蹤",
}
const SEVERITY_ZH = ["", "輕微", "中等", "嚴重"]
const CATEGORY_ZH: Record<string, string> = {
  diet: "飲食", lifestyle: "作息", exercise: "運動", tcm_herbs: "中藥", acupressure: "穴位", emotional: "情緒",
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

const num = (v: number | null | undefined, digits = 1) => (v && v > 0 ? v.toFixed(digits) : null)
/** Format a present value, or null so the row is dropped. */
const show = (v: number | null, f: (n: number) => string): string | null => (v === null ? null : f(v))
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

type Status = "ok" | "watch" | "flag" | "na"
const STATUS_ZH: Record<Status, string> = { ok: "正常範圍", watch: "偏離", flag: "明顯偏離", na: "—" }

function within(v: number | null, lo: number, hi: number, slack = 0.15): Status {
  if (v === null) return "na"
  if (v >= lo && v <= hi) return "ok"
  const span = hi - lo || 1
  return v >= lo - span * slack && v <= hi + span * slack ? "watch" : "flag"
}

export function printReport(
  r: AnalysisResult,
  health: HealthData | null,
  sessionId: string,
  generatedAt: string,
  questionnaire?: QuestionnaireResponse | null,
) {
  const hrv = health?.hrv
  const sleep = health?.sleep ?? []
  const ecg = health?.ecg_readings ?? []
  const ref = r.hrv_analysis?.reference_range
  const ica = r.integrated_cardiac_assessment

  // ── Measured values vs reference ──────────────────────────────────────
  const sdnn = hrv && hrv.sdnn > 0 ? hrv.sdnn : null
  const rmssd = hrv && hrv.rmssd > 0 ? hrv.rmssd : null
  const rhr = health?.resting_heart_rate && health.resting_heart_rate > 0 ? health.resting_heart_rate : null
  const sleepH = sleep.length ? avg(sleep.map((s) => s.total_sleep_minutes)) / 60 : null
  const eff = sleep.length ? avg(sleep.map((s) => s.sleep_efficiency)) * 100 : null
  const sdnnRef = ref && ref.sdnn_p25 > 0 ? [ref.sdnn_p25, ref.sdnn_p75] as const : [35, 60] as const
  const rmssdRef = ref && ref.rmssd_p25 > 0 ? [ref.rmssd_p25, ref.rmssd_p75] as const : [20, 50] as const
  const refNote = ref?.age_bracket && /\d/.test(ref.age_bracket) ? `${ref.age_bracket} 歲同齡 P25–P75` : "成人參考"
  const lowerOk = (v: number | null, lo: number): Status => (v === null ? "na" : v >= lo ? "ok" : v >= lo - 10 ? "watch" : "flag")
  const higherBetter = (v: number | null, p25: number): Status =>
    v === null ? "na" : v >= p25 ? "ok" : v >= p25 * 0.7 ? "watch" : "flag"
  const lfhf = hrv && hrv.lf_hf_ratio > 0 ? hrv.lf_hf_ratio : null

  const rows: { name: string; value: string | null; ref: string; status: Status }[] = [
    { name: "HRV SDNN", value: show(sdnn, (v) => `${num(v)} ms`), ref: `${sdnnRef[0]}–${sdnnRef[1]} ms（${refNote}）`, status: higherBetter(sdnn, sdnnRef[0]) },
    { name: "HRV RMSSD", value: show(rmssd, (v) => `${num(v)} ms`), ref: `${rmssdRef[0]}–${rmssdRef[1]} ms（${refNote}）`, status: higherBetter(rmssd, rmssdRef[0]) },
    { name: "LF/HF", value: show(lfhf, (v) => v.toFixed(2)), ref: `${ref?.lf_hf_normal_low ?? 1}–${ref?.lf_hf_normal_high ?? 2.5}`, status: within(lfhf, ref?.lf_hf_normal_low ?? 1, ref?.lf_hf_normal_high ?? 2.5, 0.5) },
    { name: "靜息心率", value: show(rhr, (v) => `${Math.round(v)} bpm`), ref: "60–100 bpm", status: within(rhr, 60, 100) },
    { name: "平均睡眠", value: show(sleepH, (v) => `${v.toFixed(1)} 小時（${sleep.length} 晚）`), ref: "7–9 小時", status: within(sleepH, 7, 9) },
    { name: "睡眠效率", value: show(eff, (v) => `${v.toFixed(0)}%`), ref: "≥ 85%", status: lowerOk(eff, 85) },
  ].filter((row) => row.value)

  const ecgCounts = Object.entries(
    ecg.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.classification]: (acc[e.classification] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])

  // ── Reported symptoms (moderate or worse first) ───────────────────────
  const symptoms = questionnaire
    ? (["energy", "digestion", "mood", "pain", "sleep"] as const)
        .flatMap((cat) => Object.entries(questionnaire[cat] as unknown as Record<string, number>))
        .filter(([, v]) => v >= 1)
        .sort((a, b) => b[1] - a[1])
    : []

  const urgent = r.risk_alerts.filter((a) => a.risk_level === "critical" || a.risk_level === "high")
  const dataPeriod = sleep.length
    ? `${esc(sleep[sleep.length - 1]?.date ?? "")} 至 ${esc(sleep[0]?.date ?? "")}`.replace(/^ 至 $/, "")
    : ""

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:">
<title>脈橋 健康檢視摘要 ${esc(generatedAt)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap">
<style>
  @page { size: A4; margin: 14mm 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 9.6pt/1.55 "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; color: #2f2f2b; background: #fff; overflow-wrap: anywhere; }
  .bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 16px;
         background: #F6F4EF; border-bottom: 1px solid #E3DCCD; font-size: 10pt; }
  .bar button { font: inherit; padding: 6px 16px; border-radius: 999px; border: 1px solid #D0C6B2; background: #fff; cursor: pointer; }
  .bar button.primary { background: #52705A; border-color: #52705A; color: #fff; }
  @media print { .bar { display: none; } }
  .page { max-width: 182mm; margin: 0 auto; padding: 8mm 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 8px; border-bottom: 2px solid #52705A; }
  h1 { font-size: 16pt; font-weight: 700; color: #2f2f2b; }
  h1 small { font-size: 9pt; font-weight: 400; color: #6E6C63; margin-left: 8px; }
  .meta { text-align: right; font-size: 8.5pt; color: #6E6C63; }
  h2 { font-size: 10.5pt; font-weight: 700; margin: 14px 0 6px; color: #3d4f41; }
  .attention { margin-top: 12px; padding: 10px 12px; border-radius: 8px; border: 1px solid #E3DCCD; background: #FAF8F3; }
  .attention.urgent { border-color: #e7b3ab; background: #fdf3f1; }
  .attention .lead { font-size: 11pt; font-weight: 700; }
  .attention ul { margin: 6px 0 0 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #ECE6DA; vertical-align: top; }
  th { font-size: 8.5pt; font-weight: 500; color: #6E6C63; }
  td.v { font-weight: 700; white-space: nowrap; }
  td.s-ok { color: #4E7356; } td.s-watch { color: #9a6c16; } td.s-flag { color: #AE4237; font-weight: 700; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
  .chips span { display: inline-block; margin: 0 6px 4px 0; padding: 1px 8px; border-radius: 999px; background: #F0ECE3; font-size: 8.6pt; }
  .chips span b { font-weight: 700; }
  p.body { margin-top: 2px; }
  ol.recs { margin-left: 18px; } ol.recs li { margin-bottom: 2px; }
  .note { margin-top: 4px; font-size: 8.6pt; color: #6E6C63; }
  footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #E3DCCD; font-size: 7.8pt; color: #827F74; }
  section { break-inside: avoid; }
</style>
</head>
<body>
<div class="bar">
  <span>選「列印」後，目的地選「另存為 PDF」即可存檔。</span>
  <span><button id="close">關閉</button> <button id="print" class="primary">列印</button></span>
</div>
<div class="page">
  <header>
    <h1>健康檢視摘要<small>脈橋 PulseBridge</small></h1>
    <div class="meta">
      檢視日期 ${esc(generatedAt)}${dataPeriod ? `<br>資料期間 ${dataPeriod}` : ""}<br>
      報告編號 ${esc(sessionId)}
    </div>
  </header>

  <section class="attention${urgent.length || ica.follow_up_priority === "immediate" ? " urgent" : ""}">
    <div class="lead">${esc(RISK_ZH[r.executive_summary.overall_risk_level] ?? r.executive_summary.overall_risk_level)}｜建議：${esc(FOLLOW_UP_ZH[ica.follow_up_priority] ?? "—")}</div>
    ${r.executive_summary.headline_zh ? `<p class="body">${esc(r.executive_summary.headline_zh)}</p>` : ""}
    ${urgent.length || ica.red_flags.length ? `<ul>
      ${urgent.map((a) => `<li><b>${esc(a.title_zh)}</b>：${esc(a.description_zh)}</li>`).join("")}
      ${ica.red_flags.filter((f) => !urgent.some((a) => a.title_zh === f)).map((f) => `<li>${esc(f)}</li>`).join("")}
    </ul>` : ""}
  </section>

  ${rows.length ? `<section>
    <h2>量測數據（Apple Watch）</h2>
    <table>
      <thead><tr><th>項目</th><th>數值</th><th>參考範圍</th><th>判讀</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td>${esc(row.name)}</td><td class="v">${esc(row.value)}</td><td>${esc(row.ref)}</td><td class="s-${row.status}">${STATUS_ZH[row.status]}</td></tr>`).join("")}</tbody>
    </table>
    <p class="note">參考範圍為一般族群資料，僅供對照，非診斷標準。</p>
  </section>` : ""}

  <div class="cols">
    ${ecgCounts.length ? `<section>
      <h2>心電圖（單導程，${ecg.length} 筆）</h2>
      <div class="chips">${ecgCounts.map(([c, n]) => `<span>${esc(ECG_CLASSIFICATION_LABELS[c] ?? c)} <b>${n}</b></span>`).join("")}</div>
    </section>` : ""}
    ${symptoms.length ? `<section>
      <h2>自述症狀（近兩週）</h2>
      <div class="chips">${symptoms.slice(0, 12).map(([k, v]) => `<span>${esc(SYMPTOM_LABELS[k] ?? k)} <b>${SEVERITY_ZH[v] ?? ""}</b></span>`).join("")}</div>
      ${questionnaire?.additional_notes ? `<p class="note">備註：${esc(questionnaire.additional_notes)}</p>` : ""}
    </section>` : ""}
  </div>

  <section>
    <h2>整合判讀</h2>
    <p class="body">${esc(ica.primary_conclusion_zh)}</p>
    ${r.primary_constitution ? `<p class="note">中醫觀點：目前較接近「${esc(r.primary_constitution)}」（調養方向參考，非診斷）。</p>` : ""}
  </section>

  ${r.data_driven_recommendations.length || r.recommendations.length ? `<section>
    <h2>本人預計採取的調整</h2>
    <ol class="recs">
      ${r.data_driven_recommendations.slice(0, 4).map((d) => `<li>${esc(d.title_zh)}${d.target_metric ? `（目標：${esc(d.target_metric)}）` : ""}</li>`).join("")}
      ${r.recommendations.filter((x) => x.priority === "high").slice(0, 3).map((x) => `<li>${esc(CATEGORY_ZH[x.category] ?? x.category)}：${esc(x.title_zh)}</li>`).join("")}
    </ol>
  </section>` : ""}

  <footer>
    此摘要由使用者以個人穿戴裝置資料與問卷，經 AI 輔助整理產生，非醫療機構檢驗報告，不能取代醫師診斷。
    Apple Watch 為單導程心電圖，無法排除所有心律不整。
  </footer>
</div>
</body>
</html>`

  const win = window.open("", "_blank", "width=900,height=900")
  if (!win) {
    alert("瀏覽器擋住了新視窗。請允許這個網站開啟彈出視窗後再試一次。")
    return
  }
  win.document.write(html)
  win.document.close()
  win.document.getElementById("print")?.addEventListener("click", () => win.print())
  win.document.getElementById("close")?.addEventListener("click", () => win.close())
}
