"use client"

interface DateRangePickerProps {
  minDate: string     // "YYYY-MM-DD"
  maxDate: string     // "YYYY-MM-DD"
  startDate: string
  endDate: string
  onStartChange: (v: string) => void
  onEndChange:   (v: string) => void
}

export function DateRangePicker({
  minDate, maxDate, startDate, endDate, onStartChange, onEndChange,
}: DateRangePickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg text-[var(--ink)]">要看哪一段時間？</h3>
        {minDate && (
          <p className="text-sm text-[var(--ink-3)] mt-0.5">
            檔案裡的資料從 {minDate}
            {" "}到{" "}
            {maxDate}，預設為最近 90 天。
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "開始日期", value: startDate, onChange: onStartChange, max: endDate || maxDate },
          { label: "結束日期", value: endDate,   onChange: onEndChange,   min: startDate || minDate },
        ].map((field) => (
          <div key={field.label}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{field.label}</label>
            <input
              type="date"
              value={field.value}
              min={minDate || undefined}
              max={field.max || maxDate || undefined}
              onChange={(e) => field.onChange(e.target.value)}
              className="w-full bg-[var(--surface)] border border-gray-200 rounded-xl px-3 py-2.5 text-[15px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/25 focus:border-[var(--primary)]"
            />
          </div>
        ))}
      </div>

      {startDate && endDate && startDate > endDate && (
        <p className="text-xs font-medium text-red-600">開始日期不能晚於結束日期</p>
      )}
    </div>
  )
}
