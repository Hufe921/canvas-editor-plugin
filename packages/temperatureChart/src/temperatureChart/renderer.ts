import type {
  ITemperatureChartData,
  ITemperatureChartOrientation,
  IVitalRecord
} from './interface'
import {
  BOTTOM_ROWS,
  COLORS,
  DAY_COUNT,
  FONT_FAMILY,
  GRID_HEIGHT,
  GRID_WIDTH,
  LAYOUT,
  PULSE_MAX,
  PULSE_MIN,
  SHEET_LABELS,
  SLOT_MINOR_COUNT,
  TEMP_MAX,
  TEMP_MIN,
  TEMP_MINOR_PER_MAJOR,
  TIME_SLOTS
} from './constant'

export interface ITemperatureChartRenderResult {
  dataURL: string
  width: number
  height: number
}

// ---------------- 布局度量 ----------------

const MINOR_W = LAYOUT.minorCellWidth
const MINOR_H = LAYOUT.minorCellHeight
const SLOT_W = SLOT_MINOR_COUNT * MINOR_W
const DAY_W = TIME_SLOTS.length * SLOT_W
// 眉栏与底部表格的项目名列宽 = 脉搏刻度列 + 体温刻度列（两条窄列，
// 与标准三测单一致：刻度列兼作眉栏/呼吸行/底部表格的项目名列）
const LABEL_COL_W = LAYOUT.axisPulseWidth + LAYOUT.axisTempWidth
// 眉栏与底部表格的行名文字左缘（两者对齐，使整张单子左侧成一竖列）
const LABEL_TEXT_X = LAYOUT.padding + 6

const TOTAL_WIDTH =
  LAYOUT.padding +
  LABEL_COL_W +
  GRID_WIDTH +
  LAYOUT.padding

interface IMetrics {
  gridX0: number
  gridX1: number
  gridY0: number
  headerY: number
  respirationRowY: number
  painRowY: number
  bottomY: number
  totalHeight: number
}

function computeMetrics(): IMetrics {
  const gridX0 = LAYOUT.padding + LABEL_COL_W
  const gridX1 = gridX0 + GRID_WIDTH
  let y = LAYOUT.padding
  y += LAYOUT.titleHeight
  y += LAYOUT.patientInfoHeight
  y += LAYOUT.sectionGap
  const headerY = y
  y += LAYOUT.headerRowHeight * 4
  const gridY0 = y
  y += GRID_HEIGHT
  const respirationRowY = y
  y += 18
  const painRowY = y
  y += LAYOUT.painRowHeight
  const bottomY = y
  y += LAYOUT.bottomRowHeight * BOTTOM_ROWS.length
  y += LAYOUT.padding
  return {
    gridX0,
    gridX1,
    gridY0,
    headerY,
    respirationRowY,
    painRowY,
    bottomY,
    totalHeight: y
  }
}

// ---------------- SVG 构建器 ----------------

const xmlEscape = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// 坐标保留 1 位小数，控制体积
const num = (value: number): string => `${Math.round(value * 10) / 10}`

interface ISvgTextOption {
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  color?: string
  size?: number
  bold?: boolean
}

class SvgBuilder {
  private parts: string[] = []
  private defsParts: string[] = []

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  defs(content: string) {
    this.defsParts.push(content)
  }

  polygon(points: Array<[number, number]>, fill: string) {
    const pts = points.map(([x, y]) => `${num(x)},${num(y)}`).join(' ')
    this.parts.push(`<polygon points="${pts}" fill="${fill}" stroke="none"/>`)
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    strokeWidth: number,
    dash: number[] = [],
    cap: 'butt' | 'round' = 'butt'
  ) {
    const dashAttr = dash.length
      ? ` stroke-dasharray="${dash.join(',')}"`
      : ''
    const capAttr = cap === 'round' ? ' stroke-linecap="round"' : ''
    this.parts.push(
      `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}${capAttr}/>`
    )
  }

  fillRect(x: number, y: number, width: number, height: number, fill: string) {
    this.parts.push(
      `<rect x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" fill="${fill}"/>`
    )
  }

  rect(x: number, y: number, width: number, height: number, stroke: string) {
    this.parts.push(
      `<rect x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}" fill="none" stroke="${stroke}" stroke-width="1"/>`
    )
  }

  circle(
    cx: number,
    cy: number,
    r: number,
    fill: string,
    stroke: string,
    strokeWidth: number
  ) {
    this.parts.push(
      `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
    )
  }

  text(content: string, x: number, y: number, option: ISvgTextOption = {}) {
    const {
      align = 'left',
      baseline = 'middle',
      color = COLORS.text,
      size = 10,
      bold = false
    } = option
    const anchor =
      align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
    const dominant =
      baseline === 'middle' ? 'central' : baseline === 'top' ? 'hanging' : 'auto'
    this.parts.push(
      `<text x="${num(x)}" y="${num(y)}" font-family='${FONT_FAMILY}' font-size="${size}"${bold ? ' font-weight="bold"' : ''} fill="${color}" text-anchor="${anchor}" dominant-baseline="${dominant}">${xmlEscape(content)}</text>`
    )
  }

  content(): string {
    const defs =
      this.defsParts.length > 0
        ? `<defs>${this.defsParts.join('')}</defs>`
        : ''
    return defs + this.parts.join('')
  }

  toString(): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">` +
      `<rect width="100%" height="100%" fill="${COLORS.background}"/>` +
      this.content() +
      '</svg>'
    )
  }
}

// 仅用于文本排版测宽（不参与位图渲染）
let measureCtx: CanvasRenderingContext2D | null = null
function measureTextWidth(text: string, size: number, bold = false): number {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  if (!measureCtx) {
    return text.length * size
  }
  measureCtx.font = `${bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`
  return measureCtx.measureText(text).width
}

// ---------------- 数据工具 ----------------

function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${month}-${day}`
}

// ---------------- 坐标换算 ----------------

function slotCenterX(m: IMetrics, dayIndex: number, slot: number): number {
  return (
    m.gridX0 + (dayIndex * TIME_SLOTS.length + slot) * SLOT_W + SLOT_W / 2
  )
}

function temperatureY(m: IMetrics, temperature: number): number {
  return (
    m.gridY0 + (TEMP_MAX - temperature) * TEMP_MINOR_PER_MAJOR * MINOR_H
  )
}

function pulseY(m: IMetrics, pulse: number): number {
  const perMinor = (PULSE_MAX - PULSE_MIN) / 35
  return m.gridY0 + ((PULSE_MAX - pulse) / perMinor) * MINOR_H
}

// ---------------- 区块绘制 ----------------

function drawTitle(svg: SvgBuilder, title: string) {
  // 中文标题加空格呈现经典文书样式
  const isCJK = /^[\u4e00-\u9fa5]+$/.test(title)
  const text = isCJK ? title.split('').join(' ') : title
  svg.text(text, TOTAL_WIDTH / 2, LAYOUT.padding + LAYOUT.titleHeight / 2, {
    align: 'center',
    size: 16,
    bold: true
  })
}

// 患者信息单行排布：姓名/性别/年龄/入院日期/病案号/科室/床号，按内容宽度均分
function drawPatientInfo(svg: SvgBuilder, data: ITemperatureChartData) {
  const p = data.patient
  const centerY =
    LAYOUT.padding + LAYOUT.titleHeight + LAYOUT.patientInfoHeight / 2
  // 标签加粗、值常规，增强关键信息识别度
  const segments: { label: string; value: string }[] = [
    { label: '姓名：', value: p.name || '--' },
    { label: '性别：', value: p.gender || '--' },
    { label: '年龄：', value: p.age || '--' },
    { label: '入院日期：', value: p.admissionDate || '--' },
    { label: '病案号：', value: p.hospitalNumber || '--' },
    { label: '科室：', value: p.department || '--' },
    { label: '床号：', value: p.bed || '--' }
  ]
  const contentWidth = TOTAL_WIDTH - LAYOUT.padding * 2
  const widths = segments.map(
    segment =>
      measureTextWidth(segment.label, 12, true) +
      measureTextWidth(segment.value, 12)
  )
  const total = widths.reduce((sum, w) => sum + w, 0)
  const gap = (contentWidth - total) / (segments.length - 1)
  let x = LAYOUT.padding
  segments.forEach((segment, index) => {
    const valueWidth = measureTextWidth(segment.value, 12)
    svg.text(segment.label, x, centerY, { size: 12, bold: true })
    svg.text(segment.value, x + widths[index] - valueWidth, centerY, {
      size: 12
    })
    x += widths[index] + gap
  })
}

function drawHeaderRows(
  svg: SvgBuilder,
  data: ITemperatureChartData,
  m: IMetrics
) {
  const labels = [
    SHEET_LABELS.date,
    SHEET_LABELS.hospitalDays,
    SHEET_LABELS.surgeryDays,
    SHEET_LABELS.time
  ]
  const tableX = LAYOUT.padding
  const tableW = m.gridX1 - tableX
  const rowH = LAYOUT.headerRowHeight
  // 表格外框与行分隔线（表格区统一深色线条，接近印刷样式）
  svg.rect(tableX, m.headerY, tableW, rowH * 4, COLORS.gridBoundary)
  const tableBottom = m.headerY + rowH * 4
  for (let i = 1; i < 4; i++) {
    svg.line(
      tableX,
      m.headerY + rowH * i,
      tableX + tableW,
      m.headerY + rowH * i,
      COLORS.gridBoundary,
      0.9
    )
  }
  // 项目名列
  svg.line(
    tableX + LABEL_COL_W,
    m.headerY,
    tableX + LABEL_COL_W,
    tableBottom,
    COLORS.gridBoundary,
    0.9
  )
  // 天列竖线贯穿眉栏四行（跨天界线红色与主图贯通）
  for (let day = 1; day < DAY_COUNT; day++) {
    const x = m.gridX0 + day * DAY_W
    svg.line(x, m.headerY, x, tableBottom, COLORS.red, 1.1)
  }
  // 时间行（末行）内按时间档细分竖线
  const timeRowTop = m.headerY + rowH * 3
  const totalSlots = DAY_COUNT * TIME_SLOTS.length
  for (let s = 1; s < totalSlots; s++) {
    const x = m.gridX0 + s * SLOT_W
    svg.line(x, timeRowTop, x, tableBottom, COLORS.gridBoundary, 0.8)
  }
  labels.forEach((label, i) => {
    svg.text(label, tableX + LABEL_COL_W / 2, m.headerY + rowH * i + rowH / 2, {
      align: 'center'
    })
  })
  // 日期 / 住院日数 / 手术日数：按天列填写
  const admission = parseDate(data.patient.admissionDate)
  const surgery = parseDate(data.surgeryDate)
  const surgeryRowTop = m.headerY + rowH * 2
  for (let day = 0; day < DAY_COUNT; day++) {
    const dayLeft = m.gridX0 + day * DAY_W
    const dayRight = dayLeft + DAY_W
    const cx = (dayLeft + dayRight) / 2
    if (admission) {
      svg.text(formatDate(addDays(admission, day)), cx, m.headerY + rowH * 0.5, {
        align: 'center'
      })
      svg.text(`${day + 1}`, cx, m.headerY + rowH * 1.5, { align: 'center' })
    }
    // 手术日数：术后按日填写；空白格划斜线表示“无手术”（规范）
    let surgeryText: string | null = null
    if (surgery && admission) {
      const diff = Math.round(
        (addDays(admission, day).getTime() - surgery.getTime()) / 86400000
      )
      if (diff >= 0) {
        surgeryText = `${diff}`
      }
    }
    if (surgeryText) {
      svg.text(surgeryText, cx, surgeryRowTop + rowH / 2, { align: 'center' })
    } else {
      svg.line(
        dayLeft + 3,
        surgeryRowTop + 3,
        dayRight - 3,
        surgeryRowTop + rowH - 3,
        COLORS.slash,
        1
      )
    }
  }
  // 时间行：每档竖列重复 2/6/10/14/18/22（红色，经典三测单样式）
  TIME_SLOTS.forEach((slot, slotIndex) => {
    for (let day = 0; day < DAY_COUNT; day++) {
      const left = m.gridX0 + (day * TIME_SLOTS.length + slotIndex) * SLOT_W
      svg.text(`${slot}`, left + SLOT_W / 2, m.headerY + rowH * 3.5, {
        align: 'center',
        color: COLORS.red
      })
    }
  })
}

// 竖排栏目标签（标准三测单样式：刻度列内自上而下逐字书写）
function drawVerticalLabel(
  svg: SvgBuilder,
  text: string,
  x: number,
  topY: number,
  color: string,
  size = 9
) {
  const step = size + 2
  Array.from(text).forEach((char, index) => {
    svg.text(char, x, topY + index * step + step / 2, {
      align: 'center',
      color,
      size
    })
  })
}

function drawGrid(svg: SvgBuilder, m: IMetrics) {
  // 夜间时段（18:00-06:00，即 18/22/2/6 时档）浅色背景，便于快速区分日夜
  const nightSlots = [0, 1, 4, 5]
  for (let day = 0; day < DAY_COUNT; day++) {
    nightSlots.forEach(slot => {
      const x0 = m.gridX0 + (day * TIME_SLOTS.length + slot) * SLOT_W
      svg.fillRect(x0, m.gridY0, SLOT_W, GRID_HEIGHT, COLORS.night)
    })
  }
  const totalCols = DAY_COUNT * TIME_SLOTS.length * SLOT_MINOR_COUNT
  const totalRows = (TEMP_MAX - 35) * TEMP_MINOR_PER_MAJOR
  // 竖线：小格 / 时间档 / 天边界三档，跨天界线用红色（经典三测单样式）
  for (let col = 0; col <= totalCols; col++) {
    const x = m.gridX0 + col * MINOR_W
    const isDayBoundary = col % (TIME_SLOTS.length * SLOT_MINOR_COUNT) === 0
    const isEdge = col === 0 || col === totalCols
    if (isDayBoundary) {
      svg.line(
        x,
        m.gridY0,
        x,
        m.gridY0 + GRID_HEIGHT,
        isEdge ? COLORS.gridBoundary : COLORS.red,
        1.2
      )
    } else if (col % SLOT_MINOR_COUNT === 0) {
      svg.line(x, m.gridY0, x, m.gridY0 + GRID_HEIGHT, COLORS.gridMajor, 0.9)
    } else {
      svg.line(x, m.gridY0, x, m.gridY0 + GRID_HEIGHT, COLORS.gridMinor, 0.5)
    }
  }
  // 横线：整度刻度线（1℃ / 20次/分）为中灰骨架线，
  // 37℃ 正常体温参考线用红色（经典三测单样式），0.2℃ 小格线淡而贯通
  for (let row = 0; row <= totalRows; row++) {
    const y = m.gridY0 + row * MINOR_H
    if (row % TEMP_MINOR_PER_MAJOR === 0) {
      const temperature = TEMP_MAX - row / TEMP_MINOR_PER_MAJOR
      svg.line(
        m.gridX0,
        y,
        m.gridX1,
        y,
        temperature === 37 ? COLORS.red : COLORS.gridMajor,
        0.9
      )
    } else {
      svg.line(m.gridX0, y, m.gridX1, y, COLORS.gridMinor, 0.5)
    }
  }
  // 左侧刻度栏：脉搏列（红色 180~40）与体温列（黑色 42~35）两条窄列，
  // 栏内不画横线（标准三测单做法）；竖排栏目标签写在列内左缘。
  // 数字整串绘制，故先用白底清掉穿过该列的网格线，保留顶/底外框，
  // 否则边框会被擦断、上下两个刻度数字骑在线上分不清归属
  const gridBottom = m.gridY0 + GRID_HEIGHT
  const axisLeft = LAYOUT.padding
  const pulseColRight = axisLeft + LAYOUT.axisPulseWidth
  const axisRight = m.gridX0 - 1
  svg.fillRect(
    axisLeft,
    m.gridY0 + 0.6,
    axisRight - axisLeft,
    GRID_HEIGHT - 1.2,
    COLORS.background
  )
  svg.line(axisLeft, m.gridY0, axisLeft, gridBottom, COLORS.gridBoundary, 1)
  // 脉搏列与体温列分界竖线
  svg.line(
    pulseColRight,
    m.gridY0,
    pulseColRight,
    gridBottom,
    COLORS.gridBoundary,
    0.9
  )
  // 体温数字右对齐，紧邻主图左缘；首末数字向栏内收缩，避免压顶/底边框线
  for (let t = TEMP_MAX; t >= 35; t--) {
    let y = temperatureY(m, t)
    if (t === TEMP_MAX) y += 6
    else if (t === TEMP_MIN) y -= 6
    svg.text(`${t}`, m.gridX0 - 4, y, {
      align: 'right',
      size: 10
    })
  }
  // 脉搏数字红色右对齐于脉搏列右缘；首末数字同样内缩避开边框线
  const pulsePerMajor = (PULSE_MAX - PULSE_MIN) / 7
  for (let v = PULSE_MAX; v >= PULSE_MIN; v -= pulsePerMajor) {
    let y = pulseY(m, v)
    if (v === PULSE_MAX) y += 6
    else if (v === PULSE_MIN) y -= 6
    svg.text(`${v}`, pulseColRight - 3, y, {
      align: 'right',
      color: COLORS.red,
      size: 10
    })
  }
  // 竖排栏目标签（落在 40-42℃ 刻度带内、首行刻度数字之下，与数字串左右错开）
  drawVerticalLabel(
    svg,
    '脉搏次/分',
    axisLeft + 9,
    m.gridY0 + 16,
    COLORS.text
  )
  drawVerticalLabel(
    svg,
    '体温(℃)',
    pulseColRight + 9,
    m.gridY0 + 16,
    COLORS.text
  )
}

function drawEvents(
  svg: SvgBuilder,
  data: ITemperatureChartData,
  m: IMetrics
) {
  // 事件标注（经典三测单样式）：在对应时间档格内自上而下竖排书写，
  // 时间用小字紧随其后（入院日期 -> 十时 -> 三十分），
  // 该时间档左缘画红色虚线贯穿主图，与 40℃ 线以上区域共同形成标注带。
  const events = data.events || []
  // 竖排文字的横向占位即文字实际宽度，依次排列以避免相邻事件叠压
  let occupiedRight = 0
  events.forEach(event => {
    if (event.dayIndex < 0 || event.dayIndex >= DAY_COUNT) return
    if (event.slot < 0 || event.slot >= TIME_SLOTS.length) return
    // 定位到该时间档左缘的格线，与该档的起始时刻对齐
    const slotLeft =
      m.gridX0 + (event.dayIndex * TIME_SLOTS.length + event.slot) * SLOT_W
    // 竖排文字横向只占一个字的宽度，用单字宽度估算占位，避免过度右移
    const textWidth = measureTextWidth('入', 8)
    // 与前一个事件文字太近时右移让位（同一时间档内并列书写）
    const left = Math.max(slotLeft, occupiedRight)
    // 文字写在虚线右侧，避免与虚线重叠导致难以辨认
    const x = left + textWidth / 2 + 2
    occupiedRight = x + textWidth / 2 + 3
    // 竖虚线对齐该时间档起始刻度，且自 42℃ 线起贯穿到网格底部
    const gridTop = temperatureY(m, TEMP_MAX)
    svg.line(left, gridTop, left, m.gridY0 + GRID_HEIGHT, COLORS.red, 0.8, [4, 3])
    // 竖排：事件名逐字下排，时间（09:30 -> 九时三十分）用小字紧随其后，
    // 整段落在 40-42℃ 标注带内（下限为 40℃ 线），避免压到体温曲线
    const labelSize = 8
    const timeSize = 7
    const labelChars = Array.from(event.label)
    const timeChars = Array.from(formatEventTime(event.time))
    // 标注带净高 = 40℃ 线到 42℃ 线
    const bandHeight = 2 * TEMP_MINOR_PER_MAJOR * MINOR_H
    const totalChars = labelChars.length + timeChars.length
    const step = Math.min(
      labelSize + 1,
      (bandHeight - 2) / Math.max(totalChars, 1)
    )
    let cursor = gridTop + step / 2
    const pushChars = (chars: string[], size: number) => {
      chars.forEach(char => {
        svg.text(char, x, cursor, {
          align: 'center',
          color: COLORS.red,
          size
        })
        cursor += step
      })
    }
    pushChars(labelChars, labelSize)
    pushChars(timeChars, timeSize)
  })
}

// 事件时间转中文时刻（09:30 -> 九时三十分），竖排时更易读
function formatEventTime(time?: string): string {
  if (!time) return ''
  const match = time.match(/^(\d{1,2}):(\d{1,2})$/)
  if (!match) return time
  const hour = Number(match[1])
  const minute = Number(match[2])
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const toChinese = (value: number): string => {
    if (value < 10) return digits[value]
    if (value === 10) return '十'
    if (value < 20) return `十${digits[value - 10]}`
    const tens = Math.floor(value / 10)
    const ones = value % 10
    return `${digits[tens]}十${ones ? digits[ones] : ''}`
  }
  const minuteText =
    minute % 10 === 0
      ? `${digits[minute / 10]}十`
      : toChinese(minute)
  return `${toChinese(hour)}时${minute === 0 ? '' : `${minuteText}分`}`
}

interface IPlotPoint {
  x: number
  y: number
  record: IVitalRecord
}

function drawVitals(
  svg: SvgBuilder,
  data: ITemperatureChartData,
  m: IMetrics
) {
  const records = [...data.vitals]
    .filter(
      record =>
        record.dayIndex >= 0 &&
        record.dayIndex < DAY_COUNT &&
        record.slot >= 0 &&
        record.slot < TIME_SLOTS.length
    )
    .sort((a, b) =>
      a.dayIndex !== b.dayIndex
        ? a.dayIndex - b.dayIndex
        : a.slot - b.slot
    )

  // ---- 体温：红线连常规体温（参考图配色：体温红、脉搏蓝），物理降温点红虚线连降温前体温 ----
  const regularTemps: IPlotPoint[] = []
  const coolingTemps: IPlotPoint[] = []
  records.forEach(record => {
    if (record.temperature == null) return
    const isCooling = !!record.physicalCooling
    const x =
      slotCenterX(m, record.dayIndex, record.slot) +
      (isCooling ? MINOR_W * 1.5 : 0)
    const clamped = Math.min(Math.max(record.temperature, 35), TEMP_MAX)
    const point: IPlotPoint = {
      x,
      y: temperatureY(m, clamped),
      record
    }
    if (isCooling) {
      coolingTemps.push(point)
    } else {
      regularTemps.push(point)
    }
  })
  // 常规体温连线
  for (let i = 1; i < regularTemps.length; i++) {
    const prev = regularTemps[i - 1]
    const cur = regularTemps[i]
    svg.line(prev.x, prev.y, cur.x, cur.y, COLORS.red, 1.4, [], 'round')
  }
  // 物理降温红虚线：连降温前一次常规体温
  coolingTemps.forEach(point => {
    const before = regularTemps
      .filter(
        regular =>
          regular.record.dayIndex < point.record.dayIndex ||
          (regular.record.dayIndex === point.record.dayIndex &&
            regular.record.slot <= point.record.slot)
      )
      .pop()
    if (before) {
      svg.line(before.x, before.y, point.x, point.y, COLORS.red, 1, [3, 2])
    }
  })
  // 体温符号：口温蓝● / 腋温蓝× / 肛温蓝○，物理降温红○
  const drawTempSymbol = (point: IPlotPoint, isCooling: boolean) => {
    const { x, y, record } = point
    if (record.temperature == null) return
    if (isCooling) {
      drawCircleSymbol(svg, x, y, 6, COLORS.red)
      return
    }
    // 参考图样式：体温统一画红●（口温样式）；指定腋温/肛温时画×/○
    const site = record.temperatureSite || 'oral'
    if (site === 'oral') {
      drawDotSymbol(svg, x, y, 6, COLORS.red)
    } else if (site === 'rectum') {
      drawCircleSymbol(svg, x, y, 6, COLORS.red)
    } else {
      drawCrossSymbol(svg, x, y, 6, COLORS.red)
    }
    // 体温不升：35℃线红点 + 向下箭头；超42℃：42℃线符号 + 向上箭头
    if (record.temperature < 35) {
      drawArrow(svg, x, y, MINOR_H * 2, true, COLORS.red)
    } else if (record.temperature > TEMP_MAX) {
      drawArrow(svg, x, y, MINOR_H, false, COLORS.red)
    }
  }
  regularTemps.forEach(point => drawTempSymbol(point, false))
  coolingTemps.forEach(point => drawTempSymbol(point, true))

  // ---- 脉搏红● + 心率红○，短绌脉之间红线相连 ----
  const pulsePoints: IPlotPoint[] = records
    .filter(record => record.pulse != null)
    .map(record => ({
      x: slotCenterX(m, record.dayIndex, record.slot),
      y: pulseY(
        m,
        Math.min(Math.max(record.pulse!, PULSE_MIN), PULSE_MAX)
      ),
      record
    }))
  const heartPoints: IPlotPoint[] = records
    .filter(record => record.heartRate != null)
    .map(record => ({
      x: slotCenterX(m, record.dayIndex, record.slot),
      y: pulseY(
        m,
        Math.min(Math.max(record.heartRate!, PULSE_MIN), PULSE_MAX)
      ),
      record
    }))
  // 脉搏短绌：脉搏与心率曲线之间画红色斜线阴影多边形（经典三测单画法）
  const overlapSlots = heartPoints
    .map(heart => ({
      index: pulsePoints.findIndex(
        point =>
          point.record.dayIndex === heart.record.dayIndex &&
          point.record.slot === heart.record.slot
      ),
      heart
    }))
    .filter(item => item.index >= 0)
  if (overlapSlots.length >= 2) {
    let segment: { index: number; heart: IPlotPoint }[] = []
    const flushSegment = () => {
      if (segment.length >= 2) {
        const points: Array<[number, number]> = segment.map(item => [
          pulsePoints[item.index].x,
          pulsePoints[item.index].y
        ])
        for (let i = segment.length - 1; i >= 0; i--) {
          points.push([segment[i].heart.x, segment[i].heart.y])
        }
        svg.polygon(points, 'url(#ce-tc-hatch)')
      }
      segment = []
    }
    segment.push(overlapSlots[0])
    for (let i = 1; i < overlapSlots.length; i++) {
      const prev = overlapSlots[i - 1]
      const cur = overlapSlots[i]
      const adjacent =
        cur.index === prev.index + 1 &&
        (cur.heart.record.dayIndex === prev.heart.record.dayIndex
          ? cur.heart.record.slot === prev.heart.record.slot + 1
          : cur.heart.record.dayIndex === prev.heart.record.dayIndex + 1 &&
            prev.heart.record.slot === TIME_SLOTS.length - 1 &&
            cur.heart.record.slot === 0)
      if (adjacent) {
        segment.push(cur)
      } else {
        flushSegment()
        segment.push(cur)
      }
    }
    flushSegment()
  }
  for (let i = 1; i < pulsePoints.length; i++) {
    svg.line(
      pulsePoints[i - 1].x,
      pulsePoints[i - 1].y,
      pulsePoints[i].x,
      pulsePoints[i].y,
      COLORS.blue,
      1.4,
      [],
      'round'
    )
  }
  for (let i = 1; i < heartPoints.length; i++) {
    svg.line(
      heartPoints[i - 1].x,
      heartPoints[i - 1].y,
      heartPoints[i].x,
      heartPoints[i].y,
      COLORS.red,
      1.4,
      [],
      'round'
    )
  }
  // 同一时间档心率与脉搏红线相连（脉搏短绌）
  heartPoints.forEach(heart => {
    const pulse = pulsePoints.find(
      point =>
        point.record.dayIndex === heart.record.dayIndex &&
        point.record.slot === heart.record.slot
    )
    if (pulse && Math.abs(pulse.y - heart.y) > 4) {
      svg.line(pulse.x, pulse.y, heart.x, heart.y, COLORS.red, 1)
    }
  })
  // 脉搏符号：与体温符号重叠时改为体温符号外画红圈
  pulsePoints.forEach(point => {
    const tempPoint = [...regularTemps, ...coolingTemps].find(
      candidate =>
        candidate.record.dayIndex === point.record.dayIndex &&
        candidate.record.slot === point.record.slot &&
        Math.abs(candidate.y - point.y) < 5
    )
    if (tempPoint) {
      drawCircleSymbol(svg, tempPoint.x, tempPoint.y, 8.5, COLORS.red, 1.3)
      return
    }
    // 参考图样式：脉搏画蓝×
    drawCrossSymbol(svg, point.x, point.y, 6, COLORS.blue)
    if (point.record.pulse! > PULSE_MAX) {
      drawArrow(svg, point.x, point.y, MINOR_H, false, COLORS.blue)
    } else if (point.record.pulse! < PULSE_MIN) {
      drawArrow(svg, point.x, point.y, MINOR_H, true, COLORS.blue)
    }
  })
  heartPoints.forEach(point => {
    drawCircleSymbol(svg, point.x, point.y, 6, COLORS.red)
  })
}

function drawRespirationRow(
  svg: SvgBuilder,
  data: ITemperatureChartData,
  m: IMetrics
) {
  const rowY = m.respirationRowY
  const rowH = 18
  // 呼吸以黑色数字记录，相邻数字上下错开（规范数字记录法）
  svg.rect(LAYOUT.padding, rowY, m.gridX1 - LAYOUT.padding, rowH, COLORS.gridBoundary)
  svg.line(
    LAYOUT.padding + LABEL_COL_W,
    rowY,
    LAYOUT.padding + LABEL_COL_W,
    rowY + rowH,
    COLORS.gridBoundary,
    0.9
  )
  // 按时间档细分竖线（末档格延伸至表格右缘；跨天界线红色与主图贯通）
  const respTotalSlots = DAY_COUNT * TIME_SLOTS.length
  for (let s = 1; s < respTotalSlots; s++) {
    const x = m.gridX0 + s * SLOT_W
    const isDayBoundary = s % TIME_SLOTS.length === 0
    svg.line(
      x,
      rowY,
      x,
      rowY + rowH,
      isDayBoundary ? COLORS.red : COLORS.gridBoundary,
      isDayBoundary ? 1.1 : 0.8
    )
  }
  // 标签横向单行，与底部表格行名左缘对齐（标准三测单样式）
  svg.text('呼吸(次/分)', LABEL_TEXT_X, rowY + rowH / 2, { size: 10 })
  let sequence = 0
  data.vitals
    .filter(
      record =>
        record.respiration != null &&
        record.dayIndex >= 0 &&
        record.dayIndex < DAY_COUNT &&
        record.slot >= 0 &&
        record.slot < TIME_SLOTS.length
    )
    .sort((a, b) =>
      a.dayIndex !== b.dayIndex ? a.dayIndex - b.dayIndex : a.slot - b.slot
    )
    .forEach(record => {
      const left =
        m.gridX0 + (record.dayIndex * TIME_SLOTS.length + record.slot) * SLOT_W
      const y = rowY + (sequence % 2 === 0 ? rowH * 0.32 : rowH * 0.72)
      svg.text(`${record.respiration}`, left + SLOT_W / 2, y, {
        align: 'center'
      })
      sequence++
    })
}

// 疼痛评分区：0-10 分小网格，红色▲符号画点连线（参考图样式）
function drawPainRow(
  svg: SvgBuilder,
  data: ITemperatureChartData,
  m: IMetrics
) {
  const rowY = m.painRowY
  const rowH = LAYOUT.painRowHeight
  const cellH = rowH / 11
  const pulseColRight = LAYOUT.padding + LAYOUT.axisPulseWidth
  svg.rect(LAYOUT.padding, rowY, m.gridX1 - LAYOUT.padding, rowH, COLORS.gridBoundary)
  svg.line(
    LAYOUT.padding + LABEL_COL_W,
    rowY,
    LAYOUT.padding + LABEL_COL_W,
    rowY + rowH,
    COLORS.gridBoundary,
    0.9
  )
  // 脉搏列/体温列分界竖线贯穿疼痛评分区（与主图刻度列贯通）
  svg.line(pulseColRight, rowY, pulseColRight, rowY + rowH, COLORS.gridBoundary, 0.9)
  // 分隔线：0/2/4/6/8/10 六条，与左侧刻度数字一一对应（标准图即按偶数分档）
  const painSteps = [2, 4, 6, 8]
  painSteps.forEach(step => {
    const y = rowY + (1 - step / 10) * rowH
    svg.line(m.gridX0, y, m.gridX1, y, COLORS.gridMinor, 0.5)
  })
  // 刻度数字：10/8/6/4/2/0 自上而下等距，居中于体温刻度列；
  // 首末数字向栏内收缩，避免压顶/底边框线
  const numberX = pulseColRight + LAYOUT.axisTempWidth / 2
  for (let value = 10; value >= 0; value -= 2) {
    let y = rowY + (1 - value / 10) * rowH
    if (value === 10) y += 5
    else if (value === 0) y -= 5
    svg.text(`${value}`, numberX, y, {
      align: 'center',
      size: 8
    })
  }
  // 时间档竖线（跨天界线红色与主图贯通）
  const totalSlots = DAY_COUNT * TIME_SLOTS.length
  for (let s = 1; s < totalSlots; s++) {
    const x = m.gridX0 + s * SLOT_W
    const isDayBoundary = s % TIME_SLOTS.length === 0
    svg.line(
      x,
      rowY,
      x,
      rowY + rowH,
      isDayBoundary ? COLORS.red : COLORS.gridBoundary,
      isDayBoundary ? 1.1 : 0.8
    )
  }
  // 标签：竖排“疼痛评分”，居中于脉搏刻度列（标准三测单样式）
  const titleSize = 10
  const titleTop = rowY + (rowH - 4 * (titleSize + 2)) / 2
  drawVerticalLabel(
    svg,
    '疼痛评分',
    LAYOUT.padding + LAYOUT.axisPulseWidth / 2,
    titleTop,
    COLORS.text,
    titleSize
  )
  // ▲ 符号画点 + 红线相连
  const painPoints = [...data.vitals]
    .filter(
      record =>
        record.pain != null &&
        record.dayIndex >= 0 &&
        record.dayIndex < DAY_COUNT &&
        record.slot >= 0 &&
        record.slot < TIME_SLOTS.length
    )
    .sort((a, b) =>
      a.dayIndex !== b.dayIndex ? a.dayIndex - b.dayIndex : a.slot - b.slot
    )
    .map(record => {
      const left =
        m.gridX0 + (record.dayIndex * TIME_SLOTS.length + record.slot) * SLOT_W
      const pain = Math.min(Math.max(record.pain!, 0), 10)
      return { x: left + SLOT_W / 2, y: rowY + (10 - pain) * cellH }
    })
  for (let i = 1; i < painPoints.length; i++) {
    svg.line(
      painPoints[i - 1].x,
      painPoints[i - 1].y,
      painPoints[i].x,
      painPoints[i].y,
      COLORS.red,
      1.2,
      [],
      'round'
    )
  }
  painPoints.forEach(point => {
    const r = 4.5
    svg.polygon(
      [
        [point.x, point.y - r],
        [point.x - r * 0.9, point.y + r * 0.7],
        [point.x + r * 0.9, point.y + r * 0.7]
      ],
      COLORS.red
    )
  })
}

function drawBottomTable(
  svg: SvgBuilder,
  data: ITemperatureChartData,
  m: IMetrics
) {
  const tableX = LAYOUT.padding
  const tableW = m.gridX1 - tableX
  const rowH = LAYOUT.bottomRowHeight
  const tableY = m.bottomY
  const tableH = rowH * BOTTOM_ROWS.length
  svg.rect(tableX, tableY, tableW, tableH, COLORS.gridBoundary)
  for (let i = 1; i < BOTTOM_ROWS.length; i++) {
    svg.line(
      tableX,
      tableY + rowH * i,
      tableX + tableW,
      tableY + rowH * i,
      COLORS.gridBoundary,
      0.9
    )
  }
  svg.line(
    tableX + LABEL_COL_W,
    tableY,
    tableX + LABEL_COL_W,
    tableY + tableH,
    COLORS.gridBoundary,
    0.9
  )
  // 天列分隔线（与主图对齐，跨天界线红色与主图贯通）
  for (let day = 1; day < DAY_COUNT; day++) {
    const x = m.gridX0 + day * DAY_W
    svg.line(x, tableY, x, tableY + tableH, COLORS.red, 1.1)
  }
  BOTTOM_ROWS.forEach((row, i) => {
    const y = tableY + rowH * i + rowH / 2
    svg.text(row.label, tableX + LABEL_TEXT_X, y, { size: 10 })
    const dayValues = data.bottom?.[row.key] || {}
    for (let day = 0; day < DAY_COUNT; day++) {
      const dayLeft = m.gridX0 + day * DAY_W
      const dayRight = dayLeft + DAY_W
      const value = dayValues[day]
      if (value == null || value === '') {
        // 空白格画对角斜线，表示“无内容”（规范）
        svg.line(
          dayLeft + 3,
          y - rowH / 2 + 3,
          dayRight - 3,
          y + rowH / 2 - 3,
          COLORS.slash,
          1
        )
        continue
      }
      svg.text(`${value}`, (dayLeft + dayRight) / 2, y, { align: 'center' })
    }
  })
}

// ---------------- 符号绘制 ----------------

// 蓝×（腋温）
function drawCrossSymbol(
  svg: SvgBuilder,
  x: number,
  y: number,
  r: number,
  color: string
) {
  const k = r * 0.72
  svg.line(x - k, y - k, x + k, y + k, color, 1.5)
  svg.line(x - k, y + k, x + k, y - k, color, 1.5)
}

// 实心圆点（口温 / 脉搏 / 体温不升）
function drawDotSymbol(
  svg: SvgBuilder,
  x: number,
  y: number,
  r: number,
  color: string
) {
  svg.circle(x, y, r * 0.78, color, 'none', 0)
}

// 空心圆（肛温 / 心率 / 物理降温 / 脉搏与体温重叠）
function drawCircleSymbol(
  svg: SvgBuilder,
  x: number,
  y: number,
  r: number,
  color: string,
  lineWidth = 1.5
) {
  svg.circle(x, y, r * 0.78, 'none', color, lineWidth)
}

// 箭头（体温不升↓ / 超量程↑，长度不超过规范小格数）
function drawArrow(
  svg: SvgBuilder,
  x: number,
  y: number,
  length: number,
  downward: boolean,
  color: string
) {
  const dir = downward ? 1 : -1
  const endY = y + dir * length
  svg.line(x, y + dir * 2, x, endY, color, 1.2)
  svg.line(x - 2.5, endY - dir * 3, x, endY, color, 1.2)
  svg.line(x + 2.5, endY - dir * 3, x, endY, color, 1.2)
}

// ---------------- 主渲染入口 ----------------

// UTF-8 安全的 base64 编码
function toBase64DataURL(svgText: string): string {
  const utf8Bytes = new TextEncoder().encode(svgText)
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < utf8Bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...utf8Bytes.subarray(i, i + CHUNK))
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

export function renderTemperatureChart(
  data: ITemperatureChartData,
  options?: { orientation?: ITemperatureChartOrientation }
): ITemperatureChartRenderResult {
  const orientation = options?.orientation || 'landscape'
  const metrics = computeMetrics()
  const svg = new SvgBuilder(TOTAL_WIDTH, Math.ceil(metrics.totalHeight))
  // 脉搏短绌斜线阴影图案
  svg.defs(
    '<pattern id="ce-tc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
      `<line x1="0" y1="0" x2="0" y2="6" stroke="${COLORS.red}" stroke-width="0.9"/>` +
      '</pattern>'
  )
  drawTitle(svg, '体温单')
  drawPatientInfo(svg, data)
  drawHeaderRows(svg, data, metrics)
  drawGrid(svg, metrics)
  drawEvents(svg, data, metrics)
  drawVitals(svg, data, metrics)
  drawRespirationRow(svg, data, metrics)
  drawPainRow(svg, data, metrics)
  drawBottomTable(svg, data, metrics)
  const contentWidth = TOTAL_WIDTH
  const contentHeight = Math.ceil(metrics.totalHeight)
  const background = `<rect width="100%" height="100%" fill="${COLORS.background}"/>`
  let svgText: string
  let outWidth: number
  let outHeight: number
  if (orientation === 'portrait') {
    // 竖向：整体旋转 90°，适配纵向页面（打印时可正读）
    outWidth = contentHeight
    outHeight = contentWidth
    svgText =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${outWidth} ${outHeight}">` +
      background +
      `<g transform="translate(${outWidth},0) rotate(90)">${svg.content()}</g>` +
      '</svg>'
  } else {
    outWidth = contentWidth
    outHeight = contentHeight
    svgText =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="0 0 ${outWidth} ${outHeight}">` +
      background +
      svg.content() +
      '</svg>'
  }
  return {
    dataURL: toBase64DataURL(svgText),
    width: outWidth,
    height: outHeight
  }
}
