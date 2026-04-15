import type { HealthData } from "@/types/health"
import { minutesToHM } from "@/lib/utils"
import { ECG_CLASSIFICATION_LABELS } from "@/lib/constants"

interface DataPreviewProps {
  health: HealthData
}

export function DataPreview({ health }: DataPreviewProps) {
  const hrv = health.hrv
  const avgSleep = health.sleep.length > 0
    ? health.sleep.reduce((a, s) => a + s.total_sleep_minutes, 0) / health.sleep.length
    : 0

  const ecgClassifications = health.ecg_readings.reduce((acc, r) => {
    acc[r.classification] = (acc[r.classification] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      <p className="text-gray-500 text-sm">解析完成！以下是從您的 Apple Watch 提取的健康數據：</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "ECG 記錄", value: `${health.ecg_readings.length} 筆` },
          { label: "HRV SDNN", value: hrv ? `${hrv.sdnn.toFixed(0)} ms` : "N/A" },
          { label: "平均睡眠", value: avgSleep > 0 ? minutesToHM(avgSleep) : "N/A" },
          { label: "靜息心率", value: health.resting_heart_rate > 0 ? `${health.resting_heart_rate.toFixed(0)} bpm` : "N/A" },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-900">{item.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      {Object.keys(ecgClassifications).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">ECG 分類結果</p>
          <div className="space-y-2">
            {Object.entries(ecgClassifications).map(([cls, count]) => (
              <div key={cls} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {ECG_CLASSIFICATION_LABELS[cls] ?? cls}
                </span>
                <span className={`text-sm font-medium ${cls === "sinusRhythm" ? "text-green-600" : cls === "atrialFibrillation" ? "text-red-600" : "text-amber-600"}`}>
                  {count} 次
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hrv && hrv.sdnn > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">HRV 指標</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "SDNN", value: `${hrv.sdnn.toFixed(1)} ms` },
              { label: "RMSSD", value: `${hrv.rmssd.toFixed(1)} ms` },
              { label: "LF/HF", value: hrv.lf_hf_ratio.toFixed(2) },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-lg font-bold text-[#0D7A66]">{m.value}</div>
                <div className="text-xs text-gray-400">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
