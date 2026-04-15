/**
 * 將 Apple Health 匯出的 XML 在瀏覽器端 gzip，再上傳可大幅減少流量與時間。
 * 不支援時回傳原檔（由後端只吃 .xml）。
 */
export function canGzipInBrowser(): boolean {
  return typeof CompressionStream !== "undefined"
}

/**
 * @returns gzip 後的 File（檔名 *.xml.gz），或在不支援壓縮時回傳原 file
 */
export async function gzipXmlFileForUpload(file: File): Promise<File> {
  if (!canGzipInBrowser()) {
    return file
  }
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"))
  const blob = await new Response(stream).blob()
  const lower = file.name.toLowerCase()
  const baseName = lower.endsWith(".xml")
    ? file.name.slice(0, -4)
    : file.name.replace(/\.[^/.]+$/, "") || "export"
  return new File([blob], `${baseName}.xml.gz`, {
    type: "application/gzip",
    lastModified: file.lastModified,
  })
}
