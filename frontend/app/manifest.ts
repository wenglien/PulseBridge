import type { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PulseBridge 中西醫整合健康分析",
    short_name: "PulseBridge",
    description: "整合 Apple Watch ECG、HRV 與中醫體質分析，提供個人化健康建議",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F0F4F8",
    theme_color: "#0D7A66",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [],
  }
}
