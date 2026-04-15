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
    <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50/90 to-white p-4 sm:p-5 shadow-sm space-y-3 ring-1 ring-black/[0.03]">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">選取時間範圍</h3>
        {minDate && (
          <p className="text-xs text-gray-500 mt-1">
            資料涵蓋期間：<span className="text-gray-800 font-mono">{minDate}</span>
            {" "}至{" "}
            <span className="text-gray-800 font-mono">{maxDate}</span>
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
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D7A66]/25 focus:border-[#0D7A66]"
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
