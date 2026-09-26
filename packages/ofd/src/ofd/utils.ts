// ====================================================================
// 常量
// =====================================================================

// 编辑器默认页面尺寸与页边距（A4：794x1123、[top,right,bottom,left]=100,120,100,120）
export const DEFAULT_PAGE_WIDTH = 794
export const DEFAULT_PAGE_HEIGHT = 1123
export const DEFAULT_PAGE_MARGIN: [number, number, number, number] = [
  100, 120, 100, 120
]

// 编辑器默认控件占位色（canvas-editor defaultControlOption）
export const CONTROL_PLACEHOLDER_COLOR = '#9C9B9B'

// 编辑器默认超链接色
export const HYPERLINK_COLOR = '#0000FF'

// 编辑器默认 TAB 宽度（canvas-editor defaultTabWidth）
export const DEFAULT_TAB_WIDTH = 32

// px -> pt（jsofd 的 fontSize 按 jsPDF 语义始终使用 pt）
export const PX_PER_PT = 0.75

// ====================================================================
// 浏览器工具
// =====================================================================

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

// ====================================================================
// 文本测量（垂直方向：行高与编辑器渲染同源，使用 canvas 度量）
// =====================================================================

// 字体字面高度（canvas measureText('中')，与编辑器渲染同源）
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

// ====================================================================
// 字体解析：编辑器字体族 -> jsofd 字体 key
// jsOFD 内置 simsun/simhei/kaiti/fangsong（中文）与 helvetica/times/courier；
// 映射表之外的字体（如霞鹜文楷、阿里巴巴普惠体）以规范化字体名注册
// （可嵌入用户提供的字节，或仅声明引用阅读器本机字体）
// =====================================================================

// 字体名 -> 注册键（小写、空白转连字符）
export function normalizeFontKey(family: string): string {
  return family.trim().toLowerCase().replace(/\s+/g, '-')
}

// 内置字体映射；映射表未命中返回 null（调用方决定注册自定义键）
export function mapFontFamily(
  family: string | undefined,
  defaultFamily: string
): string | null {
  const f = (family || defaultFamily || '').toLowerCase()
  if (/hei|黑|yahei|雅黑|pingfang|苹方/.test(f)) return 'simhei'
  if (/kai|楷/.test(f)) return 'kaiti'
  if (/fang|仿宋/.test(f)) return 'fangsong'
  if (/song|宋/.test(f)) return 'simsun'
  if (/times/.test(f)) return 'times'
  if (/courier|mono|consolas/.test(f)) return 'courier'
  if (/arial|helvetica|sans|segoe|ubuntu|roboto/.test(f)) return 'helvetica'
  return null
}

// 字体是否按 CJK 宽度近似计量（中文字体名或常见中文字体系）
export function isCJKFontFamily(family: string): boolean {
  return (
    /[\u4e00-\u9fff]/.test(family) ||
    /(yahei|pingfang|noto.*sc|source han|sourcehan|wenquan|wqy|lxgw|harmony|alibaba|puhui|sc-|-sc)/i.test(
      family
    )
  )
}

export function normalizeFontStyle(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return 'bolditalic'
  if (bold) return 'bold'
  if (italic) return 'italic'
  return 'normal'
}

// ====================================================================
// 颜色
// =====================================================================

// '#rgb' / '#rrggbb' / 'rgb(r,g,b)' -> '#rrggbb'；非法值返回 undefined
export function normalizeColor(color?: string): string | undefined {
  if (!color) return undefined
  const value = color.trim()
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const body = hex[1]
    if (body.length === 3) {
      return `#${body
        .split('')
        .map(ch => ch + ch)
        .join('')}`
    }
    return `#${body}`
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(',').map(p => parseFloat(p))
    if (parts.length >= 3 && parts.slice(0, 3).every(n => !isNaN(n))) {
      const [r, g, b] = parts
      const toHex = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
          .toString(16)
          .padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }
  }
  return undefined
}

// ====================================================================
// 数字转中文（页码 NumberType.CHINESE）
// =====================================================================

const CHINESE_DIGITS = [
  '零',
  '一',
  '二',
  '三',
  '四',
  '五',
  '六',
  '七',
  '八',
  '九'
]
const CHINESE_UNITS = ['', '十', '百', '千']
const CHINESE_GROUP_UNITS = ['', '万', '亿']

export function numberToChinese(num: number): string {
  if (!Number.isFinite(num)) return String(num)
  if (num < 0) return `负${numberToChinese(-num)}`
  if (num < 10) return CHINESE_DIGITS[num]
  const integer = Math.floor(num)
  if (integer <= 0) return '零'
  // 分组（万进制）
  const groups: number[] = []
  let rest = integer
  while (rest > 0) {
    groups.push(rest % 10000)
    rest = Math.floor(rest / 10000)
  }
  let result = ''
  for (let g = groups.length - 1; g >= 0; g--) {
    const group = groups[g]
    if (group === 0) continue
    let groupText = ''
    let digits = group
    const digitChars: number[] = []
    while (digits > 0) {
      digitChars.unshift(digits % 10)
      digits = Math.floor(digits / 10)
    }
    let zeroPending = false
    for (let i = 0; i < digitChars.length; i++) {
      const digit = digitChars[i]
      const unit = CHINESE_UNITS[digitChars.length - 1 - i]
      if (digit === 0) {
        zeroPending = groupText.length > 0
      } else {
        if (zeroPending) groupText += '零'
        zeroPending = false
        // 「一十」在组首省略为「十」（仅当整组为两位数）
        if (digit === 1 && unit === '十' && groupText === '') {
          groupText += '十'
        } else {
          groupText += `${CHINESE_DIGITS[digit]}${unit}`
        }
      }
    }
    result += groupText + CHINESE_GROUP_UNITS[g]
    // 组间补零：低位组不足四位时高位组后需要「零」衔接（如 一亿零一百）
    if (g > 0 && groups[g - 1] > 0 && groups[g - 1] < 1000) {
      result += '零'
    }
  }
  return result
}

// ====================================================================
// 图片
// =====================================================================

export function inferImageFormat(data: string): string {
  const match = data.match(/^data:image\/(png|jpe?g|gif|bmp);base64,/i)
  if (match) {
    const ext = match[1].toLowerCase()
    return ext === 'jpeg' ? 'JPEG' : ext.toUpperCase()
  }
  return 'PNG'
}
