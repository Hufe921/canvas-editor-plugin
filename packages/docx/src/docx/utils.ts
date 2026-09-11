export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function saveAs(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = window.URL.createObjectURL(blob)
  a.download = name
  // 部分浏览器（如 Safari）要求锚点挂载到文档中才能触发下载
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(a.href)
}

// docx 数值解析容错：剥离单位后缀（如 "42.67pt"）与空白
export function parseDocxNumber(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// 字体字面高度（canvas measureText('中')，导入导出与编辑器渲染同源）
const fontMetricsCache = new Map<string, { ascent: number; descent: number }>()
export function measureFontMetrics(
  font: string | undefined,
  size: number
): { ascent: number; descent: number } {
  const key = `${font}-${size}`
  const cached = fontMetricsCache.get(key)
  if (cached) return cached
  let metrics = { ascent: size * 0.86, descent: size * 0.14 }
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.font = `${size}px ${font || 'sans-serif'}`
      const m = ctx.measureText('中')
      if (m.actualBoundingBoxAscent && m.actualBoundingBoxDescent) {
        metrics = {
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent
        }
      }
    }
  } catch {
    // 非浏览器环境使用估算值
  }
  fontMetricsCache.set(key, metrics)
  return metrics
}

// 文本宽度测量（canvas measureText）
const textWidthCache = new Map<string, number>()
export function measureTextWidth(
  font: string | undefined,
  size: number,
  text: string
): number {
  const key = `${font}-${size}-${text}`
  const cached = textWidthCache.get(key)
  if (cached !== undefined) return cached
  let width = text.length * size
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.font = `${size}px ${font || 'sans-serif'}`
      width = ctx.measureText(text).width || width
    }
  } catch {
    // 非浏览器环境按字符数估算
  }
  textWidthCache.set(key, width)
  return width
}
