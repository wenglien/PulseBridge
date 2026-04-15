import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ConstitutionType, RiskLevel } from "@/types/analysis"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("zh-TW", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

export function minutesToHM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}小時 ${m}分` : `${m}分鐘`
}

export function riskLevelColor(level: RiskLevel): string {
  return {
    critical: "text-red-400 bg-red-400/10 border-red-400/30",
    high: "text-orange-400 bg-orange-400/10 border-orange-400/30",
    medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    low: "text-green-400 bg-green-400/10 border-green-400/30",
  }[level]
}

export function riskLevelDot(level: RiskLevel): string {
  return {
    critical: "bg-red-400",
    high: "bg-orange-400",
    medium: "bg-yellow-400",
    low: "bg-green-400",
  }[level]
}

export function constitutionColor(type: ConstitutionType): string {
  return {
    "平和質": "#16a34a",
    "氣虛質": "#d97706",
    "陽虛質": "#2563eb",
    "陰虛質": "#dc2626",
    "痰濕質": "#7c3aed",
    "濕熱質": "#ea580c",
    "血瘀質": "#9f1239",
    "氣鬱質": "#0891b2",
    "特稟質": "#c2410c",
  }[type] ?? "#6b7280"
}

export function constitutionDescription(type: ConstitutionType): string {
  return {
    "平和質": "你目前整體狀態較平衡，身體調節能力不錯。",
    "氣虛質": "你容易感到累、沒精神，身體恢復速度偏慢。",
    "陽虛質": "你偏怕冷、手腳容易冰，循環與代謝可能偏弱。",
    "陰虛質": "你容易覺得燥熱、口乾，身體可能處在較耗損狀態。",
    "痰濕質": "你可能有沉重、黏滯感，代謝與水分循環較不順。",
    "濕熱質": "你體內偏悶熱，常見油膩感、口苦或皮膚容易冒痘。",
    "血瘀質": "你的循環可能較差，容易有固定部位不舒服或痠痛。",
    "氣鬱質": "你容易受情緒與壓力影響，身體狀態會跟著起伏。",
    "特稟質": "你偏敏感體質，對環境或飲食刺激比較容易有反應。",
  }[type] ?? ""
}

export function constitutionCommonFeelings(type: ConstitutionType): string[] {
  return {
    "平和質": ["精神穩定", "睡醒後恢復感不錯", "平時較少明顯不適"],
    "氣虛質": ["容易疲累", "活動後容易喘", "感冒後恢復較慢"],
    "陽虛質": ["怕冷", "手腳冰冷", "清晨或冬天特別沒精神"],
    "陰虛質": ["口乾喉乾", "午後或夜晚偏熱", "睡眠品質容易波動"],
    "痰濕質": ["身體沉重", "容易水腫", "飯後昏沉、提不起勁"],
    "濕熱質": ["容易口苦口黏", "臉部易出油", "皮膚偶爾冒痘或發炎"],
    "血瘀質": ["局部容易痠痛", "久坐後不適明顯", "循環不佳時更不舒服"],
    "氣鬱質": ["壓力大時更疲憊", "情緒起伏影響睡眠", "容易悶悶不舒暢"],
    "特稟質": ["過敏反應較明顯", "換季時不適增加", "對刺激較敏感"],
  }[type] ?? []
}

export function constitutionQuickActions(type: ConstitutionType): string[] {
  return {
    "平和質": ["維持規律作息", "每週穩定運動 3-5 次", "持續追蹤睡眠與 HRV"],
    "氣虛質": ["先把睡眠補足", "運動以低到中強度為主", "三餐定時、避免過度節食"],
    "陽虛質": ["注意保暖，尤其腹部與四肢", "多做溫和有氧促進循環", "少吃過冷食物與飲品"],
    "陰虛質": ["減少熬夜與過度高強度訓練", "補充水分並避免太刺激飲食", "安排固定放鬆時段降負荷"],
    "痰濕質": ["增加日常活動量與步行", "減少高糖高油與宵夜", "晚餐提早、避免吃太飽"],
    "濕熱質": ["飲食以清淡為主，減少炸辣甜", "作息規律避免晚睡", "運動後確實補水與降溫"],
    "血瘀質": ["每 50-60 分鐘起身活動", "加入伸展與下肢循環運動", "睡前熱敷或溫和放鬆"],
    "氣鬱質": ["每天安排 10-15 分鐘呼吸放鬆", "固定輕中強度運動釋壓", "減少咖啡因與睡前滑手機"],
    "特稟質": ["避開已知過敏原", "建立規律睡眠提升穩定度", "有明顯反覆不適時盡早就醫評估"],
  }[type] ?? []
}

export function constitutionEmoji(type: ConstitutionType): string {
  return {
    "平和質": "🙂",
    "氣虛質": "疲",
    "陽虛質": "冷",
    "陰虛質": "熱",
    "痰濕質": "濕",
    "濕熱質": "燥",
    "血瘀質": "瘀",
    "氣鬱質": "鬱",
    "特稟質": "敏",
  }[type] ?? "•"
}

export function categoryLabel(category: string): string {
  return {
    diet: "飲食", lifestyle: "生活方式", exercise: "運動",
    tcm_herbs: "中藥", acupressure: "穴位按摩", emotional: "情緒調養",
  }[category] ?? category
}

export function categoryIcon(category: string): string {
  return {
    diet: "飲",
    lifestyle: "生",
    exercise: "動",
    tcm_herbs: "藥",
    acupressure: "穴",
    emotional: "心",
  }[category] ?? "•"
}

export function severityLabel(s: number): string {
  return ["無", "輕微", "中等", "嚴重"][s] ?? "無"
}

export function severityColor(s: number): string {
  return ["bg-slate-600", "bg-yellow-500", "bg-orange-500", "bg-red-500"][s] ?? "bg-slate-600"
}
