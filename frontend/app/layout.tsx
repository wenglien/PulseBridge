import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Navbar } from "@/components/layout/Navbar"
import { BottomNav } from "@/components/layout/BottomNav"
import { FirebaseAnalytics } from "@/components/layout/FirebaseAnalytics"

export const viewport: Viewport = {
  themeColor: "#0D7A66",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: {
    default: "PulseBridge — 中西醫整合健康分析",
    template: "%s | PulseBridge",
  },
  description: "整合 Apple Watch ECG、HRV 與中醫體質分析，提供個人化健康建議。支援心電圖分析、心率變異、睡眠評估與九種體質辨識。",
  keywords: ["中醫", "健康分析", "Apple Watch", "ECG", "HRV", "體質辨識", "心電圖"],
  authors: [{ name: "PulseBridge" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PulseBridge",
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    title: "PulseBridge — 中西醫整合健康分析",
    description: "整合 Apple Watch ECG、HRV 與中醫體質分析，提供個人化健康建議",
    siteName: "PulseBridge",
  },
  twitter: {
    card: "summary",
    title: "PulseBridge",
    description: "整合 Apple Watch 數據與中醫體質分析",
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" className="h-full">
      <head>
        <script
          // Inline, pre-hydration theme init to avoid light/dark flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text-1)] antialiased">
        <FirebaseAnalytics />
        <Navbar />
        <div className="flex-1 pb-16 md:pb-0">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}
