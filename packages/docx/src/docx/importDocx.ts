import {
  Command,
  IElement,
  IEditorData,
  ElementType,
  RowFlex,
  VerticalAlign,
  ListType,
  ListStyle,
  TitleLevel,
  ImageDisplay,
  TdBorder,
  ControlType
} from '@hufe921/canvas-editor'
import JSZip from 'jszip'
import { measureFontMetrics, parseDocxNumber } from './utils'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeImportDocx(options: IImportDocxOption): void
  }
}

export interface IImportDocxOption {
  arrayBuffer: ArrayBuffer
  // 追加模式：导入内容插入到当前文档末尾，不覆盖已有内容（#36）
  isAppend?: boolean
}

// 单位换算：1px = 15twip = 9525EMU；docx 字号为半磅
const TWIP_PER_PX = 15
const EMU_PER_PX = 9525

// 元素子节点（Element.children 在部分 DOM 实现中不可用，统一走 childNodes）
function elementChildren(element: Element): Element[] {
  const children: Element[] = []
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i]
    if (node.nodeType === 1) children.push(node as Element)
  }
  return children
}

function twipToPx(twip: number): number {
  return Math.round(twip / TWIP_PER_PX)
}

function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX)
}

function halfPointToPx(halfPoint: number): number {
  return Math.round((halfPoint * 2) / 3)
}

// docx 命名高亮色 -> hex
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#FFFF00',
  green: '#00FF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  blue: '#0000FF',
  red: '#FF0000',
  darkBlue: '#00008B',
  darkCyan: '#008B8B',
  darkGreen: '#006400',
  darkMagenta: '#8B008B',
  darkRed: '#8B0000',
  darkYellow: '#808000',
  darkGray: '#A9A9A9',
  lightGray: '#D3D3D3',
  black: '#000000',
  white: '#FFFFFF'
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  tiff: 'image/tiff'
}

const TITLE_LEVELS: TitleLevel[] = [
  TitleLevel.FIRST,
  TitleLevel.SECOND,
  TitleLevel.THIRD,
  TitleLevel.FOURTH,
  TitleLevel.FIFTH,
  TitleLevel.SIXTH
]

// ====================================================================
// 工具函数
// =====================================================================

// 解析 rels（word/_rels/xxx.xml.rels）：内部 rId -> zip 路径 / 外部 rId -> url
async function readRels(
  zip: JSZip,
  relsPath: string
): Promise<{
  internal: Map<string, string>
  external: Map<string, string>
}> {
  const internal = new Map<string, string>()
  const external = new Map<string, string>()
  const relsFile = zip.file(relsPath)
  if (!relsFile) return { internal, external }
  const dom = new DOMParser().parseFromString(
    await relsFile.async('text'),
    'application/xml'
  )
  const baseDir = relsPath.replace(/_rels\/[^/]+$/, '')
  for (const rel of Array.from(dom.getElementsByTagName('Relationship'))) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target') || ''
    if (!id || !target) continue
    if (rel.getAttribute('TargetMode') === 'External') {
      external.set(id, target)
    } else {
      internal.set(
        id,
        decodeURIComponent(
          new URL(target, 'http://localhost/' + baseDir).pathname.slice(1)
        )
      )
    }
  }
  return { internal, external }
}

// 无 extent 的图片按字节嗅探原始尺寸（PNG/GIF/BMP/JPEG）
function sniffImageSize(
  bytes: Uint8Array
): { width: number; height: number } | null {
  const be16 = (o: number) => (bytes[o] << 8) | bytes[o + 1]
  const le16 = (o: number) => bytes[o] | (bytes[o + 1] << 8)
  const be32 = (o: number) =>
    ((bytes[o] << 24) |
      (bytes[o + 1] << 16) |
      (bytes[o + 2] << 8) |
      bytes[o + 3]) >>>
    0
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: be32(16), height: be32(20) }
  }
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) {
    return { width: le16(6), height: le16(8) }
  }
  if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return {
      width: bytes[18] | (bytes[19] << 8) | (bytes[20] << 16),
      height: bytes[22] | (bytes[23] << 8) | (bytes[24] << 16)
    }
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++
        continue
      }
      const marker = bytes[offset + 1]
      const length = be16(offset + 2)
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      if (isSof) {
        return { height: be16(offset + 5), width: be16(offset + 7) }
      }
      offset += 2 + length
    }
  }
  return null
}

// 行内样式（docx rPr 的可继承子集）
interface RunStyle {
  verticalType?: 'superscript' | 'subscript'
  font?: string
  size?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikeout?: boolean
  color?: string
  highlight?: string
}

function isOn(value: string | null): boolean {
  return value !== null && value !== '0' && value !== 'false' && value !== 'off'
}

// w:b 等开关元素：无 val 属性视为开启
function readOnSwitch(rPr: Element, tag: string): boolean {
  const element = rPr.getElementsByTagName(tag)[0]
  if (!element) return false
  const val = element.getAttribute('w:val')
  return val === null || isOn(val)
}

function normalizeColor(value: string | null): string | undefined {
  if (!value || value === 'auto') return undefined
  const hex = value.replace('#', '').slice(-6).toUpperCase()
  return /^[0-9A-F]{6}$/.test(hex) ? `#${hex}` : undefined
}

function parseRPr(rPr: Element | null): RunStyle {
  const style: RunStyle = {}
  if (!rPr) return style
  if (readOnSwitch(rPr, 'w:b')) style.bold = true
  if (readOnSwitch(rPr, 'w:i')) style.italic = true
  const underline = rPr.getElementsByTagName('w:u')[0]?.getAttribute('w:val')
  if (underline && underline !== 'none') style.underline = true
  if (readOnSwitch(rPr, 'w:strike')) style.strikeout = true
  const color = normalizeColor(
    rPr.getElementsByTagName('w:color')[0]?.getAttribute('w:val') ?? null
  )
  if (color) style.color = color
  const highlight = rPr
    .getElementsByTagName('w:highlight')[0]
    ?.getAttribute('w:val')
  if (highlight && HIGHLIGHT_COLORS[highlight]) {
    style.highlight = HIGHLIGHT_COLORS[highlight]
  } else {
    // Word 高亮也常用 run 底纹（w:shd）存储
    const shdFill = normalizeColor(
      rPr.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill') ?? null
    )
    if (shdFill && shdFill !== '#FFFFFF') {
      style.highlight = shdFill
    }
  }
  // 字号：优先 w:sz，缺失时回退 w:szCs（中文 Word/WPS 常只写 szCs）
  const sizeElement = rPr.getElementsByTagName('w:sz')[0]
  const sizeCsElement = rPr.getElementsByTagName('w:szCs')[0]
  const sizeVal =
    parseDocxNumber(sizeElement?.getAttribute('w:val')) ||
    parseDocxNumber(sizeCsElement?.getAttribute('w:val'))
  if (sizeVal) style.size = halfPointToPx(sizeVal)
  const fonts = rPr.getElementsByTagName('w:rFonts')[0]
  const family =
    fonts?.getAttribute('w:eastAsia') ||
    fonts?.getAttribute('w:ascii') ||
    fonts?.getAttribute('w:hAnsi')
  if (family) style.font = family
  const vertAlign = rPr
    .getElementsByTagName('w:vertAlign')[0]
    ?.getAttribute('w:val')
  if (vertAlign === 'superscript') style.verticalType = 'superscript'
  else if (vertAlign === 'subscript') style.verticalType = 'subscript'
  return style
}

function mergeStyle(...layers: RunStyle[]): RunStyle {
  return Object.assign({}, ...layers)
}

// 区域上下文：图片/超链接关系按所在 xml 的 rels 解析
interface ZoneContext {
  rels: {
    internal: Map<string, string>
    external: Map<string, string>
  }
}

// docx 边框类型 -> 编辑器分隔线（dashArray 为 Canvas 虚线段格式）
function buildSeparator(
  borderType: string,
  sz: number,
  color?: string
): IElement {
  const dashArrayMap: Record<string, number[]> = {
    dashed: [4, 2],
    dotted: [1, 3],
    dashDot: [4, 2, 1, 2],
    dashDotDot: [4, 2, 1, 2],
    dotDash: [4, 2, 1, 2]
  }
  // w:sz 单位 1/8 pt -> px
  const lineWidth = sz ? Math.max(1, Math.round(sz / 6)) : undefined
  return {
    value: '\n',
    type: ElementType.SEPARATOR,
    ...(dashArrayMap[borderType]
      ? { dashArray: dashArrayMap[borderType] }
      : {}),
    ...(lineWidth ? { lineWidth } : {}),
    ...(color ? { color } : {})
  }
}

// VML shape style（pt）-> px
function style2WidthHeight(
  shape: Element | undefined
): {
  width?: number
  height?: number
} {
  if (!shape) return {}
  const style = shape.getAttribute('style') || ''
  const widthPt = Number(style.match(/width:([\d.]+)pt/)?.[1] || 0)
  const heightPt = Number(style.match(/height:([\d.]+)pt/)?.[1] || 0)
  return {
    ...(widthPt ? { width: Math.round((widthPt * 4) / 3) } : {}),
    ...(heightPt ? { height: Math.round((heightPt * 4) / 3) } : {})
  }
}

// 判断元素是否含实际内容（文本/图片/表格/控件/超链接等）
function hasActualContent(elements: IElement[] | undefined): boolean {
  if (!elements) return false
  for (const el of elements) {
    if (el.type === ElementType.TABLE) {
      if (
        (el.trList || []).some(tr =>
          tr.tdList.some(td => hasActualContent(td.value))
        )
      ) {
        return true
      }
    } else if (el.valueList?.length) {
      if (hasActualContent(el.valueList)) return true
    } else if (el.value && el.value !== '\n') {
      return true
    } else if (
      el.type &&
      el.type !== ElementType.TEXT &&
      el.type !== ElementType.SEPARATOR
    ) {
      return true
    }
  }
  return false
}

// 水印尺寸 clamp：超出页面时等比缩小（编辑器按原尺寸绘制，超大图会溢出画布观感）
function clampWatermarkSize(
  width: number,
  height: number,
  maxPx: { width: number; height: number }
): { width: number; height: number } {
  const scale = Math.min(
    1,
    maxPx.width / Math.max(width, 1),
    maxPx.height / Math.max(height, 1)
  )
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  }
}

let controlIdSeq = 0
function generateControlId(): string {
  controlIdSeq += 1
  return `docx-control-${controlIdSeq}`
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// 去除元素列表末尾的冗余换行（单元格/页眉页脚的边界即行边界，
// 官方 setHTML 的块级补行只对非最后子节点生效，末尾段落无尾换行）
function trimTrailingBreaks(elementList: IElement[]): IElement[] {
  while (elementList.length) {
    const last = elementList[elementList.length - 1]
    if (
      last.type === ElementType.TABLE ||
      last.type === ElementType.IMAGE ||
      last.type === ElementType.SEPARATOR
    ) {
      // 表格/图片/分隔线自带断行语义，保留（页眉底线即分隔线）
      break
    }
    if (last.value === '\n') {
      elementList.pop()
      continue
    }
    if (last.type === ElementType.TEXT && last.value?.endsWith('\n')) {
      last.value = last.value.replace(/\n$/, '')
      if (!last.value) {
        elementList.pop()
      }
      continue
    }
    break
  }
  return elementList
}

function appendLineBreak(elements: IElement[], style: RunStyle) {
  const last = elements[elements.length - 1]
  if (last && last.type === ElementType.TEXT && last.value !== '\n') {
    last.value = `${last.value}\n`
  } else {
    const { verticalType, ...runStyle } = style
    void verticalType
    elements.push({ value: '\n', type: ElementType.TEXT, ...runStyle })
  }
}

// ====================================================================
// OOXML -> 编辑器元素 解析器
// =====================================================================

class DocxParser {
  private zip: JSZip
  private headingByStyleId = new Map<string, TitleLevel>()
  private styleRPrById = new Map<string, RunStyle>()
  // numId -> 每级列表类型
  private listTypeByNumId = new Map<
    string,
    { listType: ListType; listStyle?: ListStyle }[]
  >()
  private defaultRunStyle: RunStyle = {}
  // 默认段落样式（Normal）的 rPr，参与样式合并链
  private defaultParagraphStyle: RunStyle | null = null
  // 目录样式（w:name "toc N"）styleId -> 层级
  private tocLevelByStyleId = new Map<string, number>()
  // 图片缓存：zip 路径 -> dataUrl + 原始尺寸
  private imageCache = new Map<
    string,
    { dataUrl: string; size: { width: number; height: number } | null }
  >()
  // document.xml 的关系缓存（页眉/页脚/图片引用解析共用）
  private documentRels: {
    internal: Map<string, string>
    external: Map<string, string>
  } | null = null

  constructor(zip: JSZip) {
    this.zip = zip
  }

  private async getDocumentRels() {
    if (!this.documentRels) {
      this.documentRels = await readRels(
        this.zip,
        'word/_rels/document.xml.rels'
      )
    }
    return this.documentRels
  }

  async parse(): Promise<
    IEditorData & {
      watermark?: object
      pageSetup?: object
      disabledPages?: { header?: number[]; footer?: number[] }
    }
  > {
    await this.parseStyles()
    await this.parseNumbering()
    const docFile = this.zip.file('word/document.xml')
    if (!docFile) {
      throw new Error('invalid docx: word/document.xml not found')
    }
    const docDom = new DOMParser().parseFromString(
      await docFile.async('text'),
      'application/xml'
    )
    const ctx: ZoneContext = { rels: await this.getDocumentRels() }
    // 先批量读取图片（两阶段：文件异步读取完成后再同步遍历 DOM）
    await this.cacheImages()
    const body = docDom.getElementsByTagName('w:body')[0]
    // 纸张/边距/方向 + 默认字体字号（先解析，供水印尺寸 clamp）
    const pageSetup = this.parsePageSetup(body)
    const pageSetupRecord = (pageSetup || {}) as Record<string, unknown>
    const maxWatermarkPx = {
      width: ((pageSetupRecord.width as number) || 794) * 0.95,
      height: ((pageSetupRecord.height as number) || 1123) * 0.95
    }
    const main = body ? this.parseBlockContainer(body, ctx) : []
    // 页眉页脚：取 body 级 sectPr（最后一个）的 default 引用
    const emptyZone: { elements: IElement[]; watermark?: object } = {
      elements: []
    }
    const header = body
      ? await this.parseZone('header', body, maxWatermarkPx)
      : Promise.resolve(emptyZone)
    const footer = body
      ? await this.parseZone('footer', body, maxWatermarkPx)
      : Promise.resolve(emptyZone)
    const [headerResult, footerResult] = await Promise.all([header, footer])
    // 页眉/页脚始终传键：编辑器 setEditorData 对未传 zone 保留旧数据，
    // 导入语义为整体替换，空页眉/页脚需显式传空数组清空。
    // 封面节页眉/页脚为空时（多节文档），编辑器首页禁用对应区域
    const disabledPages: { header?: number[]; footer?: number[] } = {}
    if (
      headerResult.elements.length &&
      (await this.isFirstZoneEmpty('header', body))
    ) {
      disabledPages.header = [0]
    }
    if (
      footerResult.elements.length &&
      (await this.isFirstZoneEmpty('footer', body))
    ) {
      disabledPages.footer = [0]
    }
    return {
      header: headerResult.elements,
      main,
      footer: footerResult.elements,
      ...(headerResult.watermark ? { watermark: headerResult.watermark } : {}),
      ...(pageSetup ? { pageSetup } : {}),
      ...(Object.keys(disabledPages).length ? { disabledPages } : {})
    }
  }

  // body 级 sectPr 的纸张尺寸/方向/页边距 + 文档默认字体字号
  private parsePageSetup(body: Element | null): object | undefined {
    const setup: Record<string, unknown> = {}
    const sectPrs = body?.getElementsByTagName('w:sectPr')
    const sectPr = sectPrs?.[sectPrs.length - 1]
    const pgSz = sectPr?.getElementsByTagName('w:pgSz')[0]
    if (pgSz) {
      const width = twipToPx(parseDocxNumber(pgSz.getAttribute('w:w')))
      const height = twipToPx(parseDocxNumber(pgSz.getAttribute('w:h')))
      if (width && height) {
        setup.width = width
        setup.height = height
        setup.paperDirection =
          pgSz.getAttribute('w:orient') === 'landscape'
            ? 'horizontal'
            : 'vertical'
      }
    }
    const pgMar = sectPr?.getElementsByTagName('w:pgMar')[0]
    if (pgMar) {
      const top = twipToPx(parseDocxNumber(pgMar.getAttribute('w:top')))
      const right = twipToPx(parseDocxNumber(pgMar.getAttribute('w:right')))
      const bottom = twipToPx(parseDocxNumber(pgMar.getAttribute('w:bottom')))
      const left = twipToPx(parseDocxNumber(pgMar.getAttribute('w:left')))
      if (top && right && bottom && left) {
        setup.margins = [top, right, bottom, left]
      }
    }
    // 文档默认字体/字号（新输入内容跟随）：优先 Normal 默认段落样式（docDefaults 常无字号）
    const defaultStyle = this.defaultParagraphStyle || {}
    const defaultFont = defaultStyle.font || this.defaultRunStyle.font
    const defaultSize = defaultStyle.size || this.defaultRunStyle.size
    if (defaultFont) {
      setup.defaultFont = defaultFont
    }
    if (defaultSize) {
      setup.defaultSize = defaultSize
    }
    return Object.keys(setup).length ? setup : undefined
  }

  // 批量读取 word/media 图片为 dataUrl 并嗅探原始尺寸
  private async cacheImages() {
    for (const path of Object.keys(this.zip.files)) {
      if (!/^word\/media\//.test(path)) continue
      const ext = path.split('.').pop()?.toLowerCase() || ''
      const mime = MIME_BY_EXT[ext]
      if (!mime) continue
      const base64 = await this.zip.files[path].async('base64')
      const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
      this.imageCache.set(path, {
        dataUrl: `data:${mime};base64,${base64}`,
        size: sniffImageSize(bytes)
      })
    }
  }

  // 样式表：docDefaults 默认字体字号、段落样式（标题级别映射 + basedOn 继承链）
  private async parseStyles() {
    const stylesFile = this.zip.file('word/styles.xml')
    if (!stylesFile) return
    const dom = new DOMParser().parseFromString(
      await stylesFile.async('text'),
      'application/xml'
    )
    const rPrDefault = dom.getElementsByTagName('w:rPrDefault')[0]
    if (rPrDefault) {
      this.defaultRunStyle = parseRPr(
        rPrDefault.getElementsByTagName('w:rPr')[0] || null
      )
    }
    const basedOnById = new Map<string, string>()
    const rawRPrById = new Map<string, Element | null>()
    for (const style of Array.from(dom.getElementsByTagName('w:style'))) {
      const id = style.getAttribute('w:styleId')
      if (!id) continue
      // 默认段落样式（Normal）：无 pStyle 段落的字号/字体来源
      if (
        style.getAttribute('w:type') === 'paragraph' &&
        style.getAttribute('w:default') === '1' &&
        !this.defaultParagraphStyle
      ) {
        this.defaultParagraphStyle = parseRPr(
          style.getElementsByTagName('w:rPr')[0] || null
        )
      }
      const name = style
        .getElementsByTagName('w:name')[0]
        ?.getAttribute('w:val')
        ?.toLowerCase()
      // 目录样式：w:name "toc N"
      const tocMatch = name?.match(/^toc (\d)$/)
      if (tocMatch) {
        this.tocLevelByStyleId.set(id, Number(tocMatch[1]))
      }
      // 标题样式：w:name "heading N" 或 w:outlineLvl
      const headingMatch = name?.match(/^heading (\d)$/)
      if (headingMatch) {
        this.headingByStyleId.set(id, TITLE_LEVELS[Number(headingMatch[1]) - 1])
      } else {
        const outlineLvl = Number(
          style
            .getElementsByTagName('w:outlineLvl')[0]
            ?.getAttribute('w:val') ?? -1
        )
        if (outlineLvl >= 0 && outlineLvl < 6) {
          this.headingByStyleId.set(id, TITLE_LEVELS[outlineLvl])
        }
      }
      const basedOn = style
        .getElementsByTagName('w:basedOn')[0]
        ?.getAttribute('w:val')
      if (basedOn) basedOnById.set(id, basedOn)
      rawRPrById.set(id, style.getElementsByTagName('w:rPr')[0] || null)
    }
    const resolve = (id: string, depth = 0): RunStyle => {
      if (depth > 5) return {}
      const basedOn = basedOnById.get(id)
      const layers = basedOn ? [resolve(basedOn, depth + 1)] : []
      layers.push(parseRPr(rawRPrById.get(id) ?? null))
      return mergeStyle(...layers)
    }
    for (const id of Array.from(rawRPrById.keys())) {
      this.styleRPrById.set(id, resolve(id))
    }
  }

  // 编号：numId -> 各级 numFmt（bullet -> 无序列表，其余 -> 有序列表）
  private async parseNumbering() {
    const numberingFile = this.zip.file('word/numbering.xml')
    if (!numberingFile) return
    const dom = new DOMParser().parseFromString(
      await numberingFile.async('text'),
      'application/xml'
    )
    const levelListByAbstractId = new Map<
      string,
      { listType: ListType; listStyle?: ListStyle }[]
    >()
    for (const abstractNum of Array.from(
      dom.getElementsByTagName('w:abstractNum')
    )) {
      // 仅直属层级（getElementsByTagName 会含嵌套）
      const lvlElements = elementChildren(abstractNum).filter(
        child => child.tagName === 'w:lvl'
      )
      const levels: { listType: ListType; listStyle?: ListStyle }[] = []
      for (const lvl of lvlElements) {
        const numFmt = lvl
          .getElementsByTagName('w:numFmt')[0]
          ?.getAttribute('w:val')
        levels.push(
          numFmt === 'bullet'
            ? { listType: ListType.UL, listStyle: ListStyle.DISC }
            : { listType: ListType.OL, listStyle: ListStyle.DECIMAL }
        )
      }
      levelListByAbstractId.set(
        abstractNum.getAttribute('w:abstractNumId') || '',
        levels
      )
    }
    for (const num of Array.from(dom.getElementsByTagName('w:num'))) {
      const numId = num.getAttribute('w:numId') || ''
      const abstractId = num
        .getElementsByTagName('w:abstractNumId')[0]
        ?.getAttribute('w:val')
      if (numId && abstractId) {
        this.listTypeByNumId.set(
          numId,
          levelListByAbstractId.get(abstractId) || []
        )
      }
    }
  }

  // 解析节引用的页眉/页脚 DOM 与 rels。
  // direction：'first' 取第一个带引用的节（封面判定）/ 'last' 取最后一个
  // （OOXML 节继承语义：未定义引用的节继承前一节，正文页眉页脚=最近的引用）。
  // 仅解析被引用的文件，不按文件名猜测——避免捞到未引用的遗留文件
  private async resolveZone(
    zone: 'header' | 'footer',
    body: Element,
    direction: 'first' | 'last'
  ): Promise<{ root: Element; rels: ZoneContext['rels'] } | null> {
    const sectPrs = body.getElementsByTagName('w:sectPr')
    const indexes = Array.from({ length: sectPrs.length }, (_, i) => i)
    const order = direction === 'first' ? indexes : indexes.reverse()
    for (const i of order) {
      const zoneReferences = Array.from(
        sectPrs[i].getElementsByTagName(`w:${zone}Reference`)
      )
      if (!zoneReferences.length) continue
      const reference =
        zoneReferences.find(r => r.getAttribute('w:type') === 'default') ||
        zoneReferences[0]
      const rId = reference?.getAttribute('r:id') || ''
      const zonePath = rId
        ? (await this.getDocumentRels()).internal.get(rId)
        : undefined
      const zoneFile = zonePath ? this.zip.file(zonePath) : null
      if (!zonePath || !zoneFile) return null
      const zoneDom = new DOMParser().parseFromString(
        await zoneFile.async('text'),
        'application/xml'
      )
      const root =
        zoneDom.getElementsByTagName(`w:${zone}`)[0] || zoneDom.documentElement
      const rels = await readRels(
        this.zip,
        `word/_rels/${zonePath.split('/').pop() || ''}.rels`
      )
      return { root, rels }
    }
    return null
  }

  // 判定第一节（文档开头）的页眉/页脚是否无实际内容
  private async isFirstZoneEmpty(
    zone: 'header' | 'footer',
    body: Element
  ): Promise<boolean> {
    const resolved = await this.resolveZone(zone, body, 'first')
    if (!resolved) return true
    return !hasActualContent(
      this.parseBlockContainer(resolved.root, { rels: resolved.rels })
    )
  }

  // 解析页眉/页脚为元素列表（header 可能携带 Word 水印）
  private async parseZone(
    zone: 'header' | 'footer',
    body: Element,
    maxWatermarkPx: { width: number; height: number }
  ): Promise<{ elements: IElement[]; watermark?: object }> {
    const resolved = await this.resolveZone(zone, body, 'last')
    if (!resolved) return { elements: [] }
    const { root, rels } = resolved
    const elements = trimTrailingBreaks(
      // 过滤完全无内容的装饰表格（WPS 页眉页脚的空三栏骨架）
      this.parseBlockContainer(root, { rels }).filter(
        el =>
          el.type !== ElementType.TABLE ||
          (el.trList || []).some(tr =>
            tr.tdList.some(td => hasActualContent(td.value))
          )
      )
    )
    // Word 水印：header 中的 VML 文字/图片水印 shape、衬底浮动图片
    const watermark = this.parseWatermark(root, rels, maxWatermarkPx)
    // 已识别为水印的衬底大图不再保留在页眉内容中（避免双重）
    const finalElements = watermark
      ? elements.filter(
          el =>
            !(
              el.type === ElementType.IMAGE &&
              el.imgDisplay === ImageDisplay.FLOAT_BOTTOM &&
              (el.width || 0) >= 300
            )
        )
      : elements
    return { elements: finalElements, ...(watermark ? { watermark } : {}) }
  }

  // Word 水印（v:shape 含 v:textpath 文字或 v:imagedata 图片，id 通常为
  // PowerPlusWaterMarkObject）-> 编辑器 watermark 配置
  private parseWatermark(
    root: Element,
    rels: { internal: Map<string, string> },
    maxPx: { width: number; height: number }
  ): object | undefined {
    // 图片水印：header 内衬于文字下方（behindDoc）的浮动图片
    for (const anchor of Array.from(root.getElementsByTagName('wp:anchor'))) {
      if (anchor.getAttribute('behindDoc') !== '1') continue
      const blip = anchor.getElementsByTagName('a:blip')[0]
      const rId = blip?.getAttribute('r:embed') || ''
      const path = rels.internal.get(rId)
      const cached = path ? this.imageCache.get(path) : null
      if (!cached) continue
      const extent = anchor.getElementsByTagName('wp:extent')[0]
      const width = emuToPx(Number(extent?.getAttribute('cx') || 0))
      const height = emuToPx(Number(extent?.getAttribute('cy') || 0))
      // 图片水印：宽度超过内容区一半的衬底图
      if (width < 300) continue
      const clamped = clampWatermarkSize(width, height, maxPx)
      return {
        type: 'image',
        data: cached.dataUrl,
        width: clamped.width,
        height: clamped.height,
        layer: 'bottom'
      }
    }
    for (const pict of Array.from(root.getElementsByTagName('w:pict'))) {
      const shape = pict.getElementsByTagName('v:shape')[0]
      if (!shape) continue
      const shapeId = shape.getAttribute('id') || ''
      const textPath = shape.getElementsByTagName('v:textpath')[0]
      const imageData = shape.getElementsByTagName('v:imagedata')[0]
      const isWatermarkShape =
        textPath ||
        /watermark/i.test(shapeId) ||
        (shape.getElementsByTagName('v:fill').length > 0 &&
          !!shape.getAttribute('o:allowincell'))
      if (textPath) {
        const data = textPath.getAttribute('string') || ''
        if (!data) continue
        // Word 水印 shape 的 font-size 恒为 1pt（fitshape 拉伸渲染），
        // 实际字形高 ≈ shape 高 / 1.4，size 按此推算
        const shapeSize = style2WidthHeight(shape)
        const size = shapeSize.height
          ? Math.max(12, Math.round(shapeSize.height / 1.4))
          : undefined
        const fill = shape.getAttribute('fillcolor') || ''
        const opacity = Number(
          shape.getElementsByTagName('v:fill')[0]?.getAttribute('opacity') || 1
        )
        return {
          type: 'text',
          data,
          ...(fill && fill !== 'silver' ? { color: normalizeColor(fill) } : {}),
          ...(opacity !== 1 ? { opacity } : {}),
          ...(size ? { size } : {})
        }
      }
      if (imageData && isWatermarkShape) {
        const rId = imageData.getAttribute('r:id') || ''
        const path = rels.internal.get(rId)
        const cached = path ? this.imageCache.get(path) : null
        if (cached) {
          const { width = 0, height = 0 } = style2WidthHeight(shape)
          return {
            type: 'image',
            data: cached.dataUrl,
            ...(width ? { width } : {}),
            ...(height ? { height } : {})
          }
        }
      }
    }
    return undefined
  }

  // 遍历块级容器（body / 页眉页脚根 / 单元格）的直属子节点
  private parseBlockContainer(
    container: Element,
    ctx: ZoneContext
  ): IElement[] {
    const elementList: IElement[] = []
    // 上一段落遗留的行尾换行：列表/表格/分隔线自带断行时省略，避免空行
    let pendingBreak = false
    const flushBreak = (isSelfLineBreak: boolean) => {
      if (pendingBreak && !isSelfLineBreak) {
        elementList.push({ value: '\n' })
      }
      pendingBreak = false
    }
    for (const child of elementChildren(container)) {
      if (child.tagName === 'w:p') {
        const { elements, trailingBreak } = this.parseParagraph(child, ctx)
        flushBreak(
          elements[0]?.type === ElementType.LIST ||
            elements[0]?.type === ElementType.TABLE ||
            elements[0]?.type === ElementType.SEPARATOR
        )
        elementList.push(...elements)
        pendingBreak = trailingBreak
      } else if (child.tagName === 'w:tbl') {
        flushBreak(true)
        elementList.push(this.parseTable(child, ctx))
      } else if (child.tagName === 'w:sdt') {
        // 内容控件：优先映射为编辑器原生控件（独立成段），
        // 非控件 sdt 递归解析内容
        const controlElement = this.parseSdtControl(child, ctx)
        if (controlElement) {
          flushBreak(false)
          elementList.push(controlElement)
          elementList.push({ value: '\n' })
        } else {
          const sdtContent = elementChildren(child).find(
            el => el.tagName === 'w:sdtContent'
          )
          if (sdtContent) {
            const elements = this.parseBlockContainer(sdtContent, ctx)
            flushBreak(
              elements[0]?.type === ElementType.LIST ||
                elements[0]?.type === ElementType.TABLE
            )
            elementList.push(...elements)
          }
        }
      }
      // sectPr / 书签等其它节点跳过
    }
    if (pendingBreak) {
      elementList.push({ value: '\n' })
    }
    return this.fixupTransitions(elementList)
  }

  // 块级衔接优化（对齐编辑器 setHTML 的数据规范，避免连续换行产生空行）：
  // 1. 标题后补换行——下一元素为列表/表格/分隔线或自带行首换行时不补（INLINE_NODE_NAME 规则）
  // 2. 列表/表格/分隔线自带断行，删除前一元素冗余的行尾换行
  //    （与编辑器 insertElementList"列表前如有换行符则删除-因为列表内已存在"同规则）
  private fixupTransitions(elementList: IElement[]): IElement[] {
    const result: IElement[] = []
    for (let i = 0; i < elementList.length; i++) {
      const element = elementList[i]
      const next = elementList[i + 1]
      const isSelfLineBreakElement =
        element.type === ElementType.LIST ||
        element.type === ElementType.TABLE ||
        element.type === ElementType.SEPARATOR
      // 规则2：前一元素行尾 \n 冗余（独立 \n 空段落除外）
      if (isSelfLineBreakElement) {
        const prev = result[result.length - 1]
        if (
          prev &&
          !prev.valueList?.length &&
          prev.type !== ElementType.TITLE &&
          prev.type !== ElementType.TABLE &&
          prev.type !== ElementType.LIST &&
          prev.value &&
          prev.value !== '\n' &&
          prev.value.endsWith('\n')
        ) {
          prev.value = prev.value.replace(/\n$/, '')
        }
        result.push(element)
        continue
      }
      result.push(element)
      // 规则1：标题后补换行
      if (element.type !== ElementType.TITLE) continue
      if (!next) continue
      const nextIsSelfLineBreak =
        next.type === ElementType.LIST ||
        next.type === ElementType.TABLE ||
        next.type === ElementType.SEPARATOR
      const nextValue = next.valueList?.length
        ? next.valueList[0].value
        : next.value
      if (!nextIsSelfLineBreak && !nextValue?.startsWith('\n')) {
        result.push({ value: '\n' })
      }
    }
    return result
  }

  // 段落 -> 元素列表（标题 / 列表 / 普通文本行）
  // trailingBreak：段落以非文本元素（超链接/图片等）结尾时的行尾换行，
  // 由上层根据下一个块级元素类型决定是否补（列表/表格自带断行时省略）
  private parseParagraph(
    p: Element,
    ctx: ZoneContext
  ): { elements: IElement[]; trailingBreak: boolean } {
    const pPr = p.getElementsByTagName('w:pPr')[0] || null
    const pStyleId =
      pPr?.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ??
      undefined
    const headingLevel = pStyleId
      ? this.headingByStyleId.get(pStyleId)
      : undefined

    const prefix: IElement[] = pPr?.getElementsByTagName('w:pageBreakBefore')
      .length
      ? [{ value: '', type: ElementType.PAGE_BREAK }]
      : []

    // 段落底边框的空段落 -> 分隔线（Word"下框线"）
    const separator = this.parseBorderSeparator(p, pPr)
    if (separator) {
      return { elements: [...prefix, separator], trailingBreak: false }
    }

    const inline = this.parseInlineContent(p, ctx, pStyleId)

    // 列表段落：官方壳结构（valueList 扁平流：行首 \n + 内容，项间单换行）
    const numPr = pPr?.getElementsByTagName('w:numPr')[0]
    if (numPr) {
      const numId = numPr
        .getElementsByTagName('w:numId')[0]
        ?.getAttribute('w:val')
      const ilvl = Number(
        numPr.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val') || 0
      )
      const listType = numId ? this.listTypeByNumId.get(numId) : undefined
      if (listType?.[ilvl]) {
        const { listType: type, listStyle } = listType[ilvl]
        const valueList: IElement[] = [{ value: '\n' }]
        for (const element of inline) {
          // 项内软换行拆为独立 \n 并标记 listWrap（避免被识别为新列表项）
          if (
            element.type === ElementType.TEXT &&
            element.value?.includes('\n')
          ) {
            const parts = element.value.split('\n')
            for (let p = 0; p < parts.length; p++) {
              if (parts[p]) {
                valueList.push({ ...element, value: parts[p] })
              }
              if (p < parts.length - 1) {
                valueList.push({ value: '\n', listWrap: true })
              }
            }
          } else {
            valueList.push(element)
          }
        }
        return {
          elements: [
            ...prefix,
            {
              value: '',
              type: ElementType.LIST,
              listId: numId || '1',
              listType: type,
              ...(listStyle ? { listStyle } : {}),
              listLevel: ilvl,
              valueList
            }
          ],
          trailingBreak: false
        }
      }
    }

    // 行属性（行距换算需要段落字号）
    const paragraphSize =
      parseDocxNumber(
        p.getElementsByTagName('w:sz')[0]?.getAttribute('w:val')
      ) || undefined
    const props = this.parseParagraphProps(
      pPr,
      paragraphSize
        ? halfPointToPx(paragraphSize)
        : (pStyleId ? this.styleRPrById.get(pStyleId)?.size : undefined) ||
            this.defaultParagraphStyle?.size ||
            this.defaultRunStyle.size
    )

    // 目录条目（pStyle 为 toc N 样式）
    const tocLevel = pStyleId
      ? this.tocLevelByStyleId.get(pStyleId)
      : undefined
    if (tocLevel) {
      return {
        elements: [
          ...prefix,
          ...this.parseTocEntry(inline, tocLevel, props.rowFlex)
        ],
        trailingBreak: false
      }
    }

    // 标题段落：runs 归入 valueList
    if (headingLevel) {
      const valueList = inline
        .filter(element => element.value !== '\n')
        .map(element => ({
          ...element,
          value: element.value?.replace(/\n$/, '') || ''
        }))
      return {
        elements: [
          ...prefix,
          {
            value: '',
            type: ElementType.TITLE,
            level: headingLevel,
            ...(props.rowFlex ? { rowFlex: props.rowFlex } : {}),
            ...(props.rowMargin ? { rowMargin: props.rowMargin } : {}),
            valueList
          }
        ],
        trailingBreak: false
      }
    }

    // 普通段落：行属性写入行内元素，行尾补 \n
    const lineElements: IElement[] = inline.map(element => ({
      ...element,
      ...(props.rowFlex && !element.rowFlex ? { rowFlex: props.rowFlex } : {}),
      ...(props.rowMargin && element.rowMargin === undefined
        ? { rowMargin: props.rowMargin }
        : {})
    }))
    if (!lineElements.length) {
      // \n 为行结束标记，不携带 rowFlex（编辑器断行时 \n 归入下一行，
      // 携带对齐会污染下一行的行首对齐）
      return {
        elements: [
          ...prefix,
          {
            value: '\n',
            type: ElementType.TEXT,
            ...(props.rowMargin ? { rowMargin: props.rowMargin } : {})
          }
        ],
        trailingBreak: false
      }
    }
    const last = lineElements[lineElements.length - 1]
    if (last.type === ElementType.TEXT && last.value !== undefined) {
      last.value = last.value.endsWith('\n') ? last.value : `${last.value}\n`
      return { elements: [...prefix, ...lineElements], trailingBreak: false }
    }
    // 分隔线自带行尾换行
    if (last.type === ElementType.SEPARATOR) {
      return { elements: [...prefix, ...lineElements], trailingBreak: false }
    }
    // 非文本结尾：行尾换行延后由上层决定
    return { elements: [...prefix, ...lineElements], trailingBreak: true }
  }

  // 目录条目规整化：编辑器不支持段落缩进与制表符点线，目录原样导入会
  // 层级混乱、页码位置乱跳——层级用全角空格缩进、统一文档默认字号、
  // 制表符退化为空格分隔
  private parseTocEntry(
    inline: IElement[],
    tocLevel: number,
    rowFlex?: RowFlex
  ): IElement[] {
    const defaultSize =
      this.defaultParagraphStyle?.size || this.defaultRunStyle.size
    const cleaned = inline.flatMap(element => {
      if (element.type === ElementType.TAB) {
        return [{ value: '  ', type: ElementType.TEXT }]
      }
      const { size, ...rest } = element
      void size
      return [{ ...rest, ...(defaultSize ? { size: defaultSize } : {}) }]
    })
    const indent = '\u3000'.repeat((tocLevel - 1) * 2)
    if (indent) {
      if (cleaned.length && cleaned[0].type === ElementType.TEXT) {
        cleaned[0].value = `${indent}${cleaned[0].value || ''}`
      } else {
        cleaned.unshift({ value: indent, type: ElementType.TEXT })
      }
    }
    if (!cleaned.length) {
      return [{ value: '\n', type: ElementType.TEXT }]
    }
    const lastClean = cleaned[cleaned.length - 1]
    if (lastClean.type === ElementType.TEXT && lastClean.value !== undefined) {
      lastClean.value = lastClean.value.endsWith('\n')
        ? lastClean.value
        : `${lastClean.value}\n`
    } else {
      cleaned.push({ value: '\n', type: ElementType.TEXT })
    }
    return cleaned.map(element => ({
      ...element,
      ...(rowFlex && !element.rowFlex ? { rowFlex } : {})
    }))
  }

  // 段落底边框（w:pBdr > w:bottom）的空段落 -> 分隔线
  private parseBorderSeparator(
    p: Element,
    pPr: Element | null
  ): IElement | null {
    const pBdr = pPr?.getElementsByTagName('w:pBdr')[0]
    const bottom = pBdr?.getElementsByTagName('w:bottom')[0]
    if (!bottom) return null
    const borderType = bottom.getAttribute('w:val') || ''
    if (['', 'nil', 'none'].includes(borderType)) return null
    // 有文本内容的为带下边框的文字段落，保留为文本
    const text = Array.from(p.getElementsByTagName('w:t'))
      .map(t => t.textContent || '')
      .join('')
      .trim()
    if (text) return null
    return buildSeparator(
      borderType,
      Number(bottom.getAttribute('w:sz') || 0),
      normalizeColor(bottom.getAttribute('w:color'))
    )
  }

  // VML 横线（w:pict 里的 v:line 或扁长 v:rect，Word"插入横线"）-> 分隔线
  private parseVmlSeparator(pict: Element): IElement | null {
    const line = pict.getElementsByTagName('v:line')[0]
    const rect = pict.getElementsByTagName('v:rect')[0]
    if (!line && !rect) return null
    const shape = line || rect
    if (rect) {
      // 矩形需扁长（高度 <= 3pt）才是横线，否则为形状
      const heightPt = Number(
        (rect.getAttribute('style') || '').match(/height:([\d.]+)pt/)?.[1] || 0
      )
      if (heightPt > 3) return null
    }
    const strokeWeightPt = parseDocxNumber(shape?.getAttribute('strokeweight'))
    const dashStyle = shape?.getAttribute('dashstyle') || ''
    return buildSeparator(
      dashStyle && dashStyle !== 'solid' ? 'dashed' : 'single',
      strokeWeightPt ? strokeWeightPt * 8 : 0,
      undefined
    )
  }

  private parseParagraphProps(
    pPr: Element | null,
    fontSize?: number
  ): {
    rowFlex?: RowFlex
    rowMargin?: number
  } {
    const props: { rowFlex?: RowFlex; rowMargin?: number } = {}
    if (!pPr) return props
    const jc = pPr.getElementsByTagName('w:jc')[0]?.getAttribute('w:val')
    const alignMap: Record<string, RowFlex> = {
      left: RowFlex.LEFT,
      start: RowFlex.LEFT,
      center: RowFlex.CENTER,
      right: RowFlex.RIGHT,
      end: RowFlex.RIGHT,
      both: RowFlex.ALIGNMENT,
      distribute: RowFlex.ALIGNMENT
    }
    if (jc && alignMap[jc]) props.rowFlex = alignMap[jc]
    // 行距换算（编辑器行高 = 字面高 + 上下各 basicRowMarginHeight × 字号系数 × 倍数）：
    // auto：line/240 即倍数，与 rowMargin 语义一致；
    // exact/atLeast：固定行高，反推倍数 = (行高px − 字面高px) / (2 × 8 × 字号系数)，
    // 保证与导出侧（行高 px → atLeast twip）往返一致
    const spacing = pPr.getElementsByTagName('w:spacing')[0]
    const line = parseDocxNumber(spacing?.getAttribute('w:line'))
    const lineRule = spacing?.getAttribute('w:lineRule') || 'auto'
    if (line && line > 0) {
      if (lineRule === 'auto') {
        props.rowMargin = round2(line / 240)
      } else {
        const lineHeightPx = line / TWIP_PER_PX
        const size = fontSize || 16
        let ratio = 1
        if (size < 12) {
          ratio = size / 12
        } else if (size > 30) {
          ratio = 1 + (size - 30) / 30
        }
        const { ascent, descent } = measureFontMetrics(undefined, size)
        const glyphPx = ascent + descent
        const margin = round2(
          Math.max((lineHeightPx - glyphPx) / (2 * 8 * ratio), 0.5)
        )
        props.rowMargin = margin
      }
    }
    return props
  }

  // 段落内的行内内容：runs、超链接、内容控件、域
  private parseInlineContent(
    p: Element,
    ctx: ZoneContext,
    pStyleId?: string
  ): IElement[] {
    const elements: IElement[] = []
    // 旧式窗体域状态：null=普通 / 'ff'=窗体域内部（跳过显示值直到 end）
    let inFormField: 'ff' | null = null
    for (const child of elementChildren(p)) {
      const tag = child.tagName
      if (tag === 'w:r') {
        // 域字符（fldChar）：窗体域转控件，普通域跳过指令部分
        const fldChar = child.getElementsByTagName('w:fldChar')[0]
        if (fldChar) {
          const fldCharType = fldChar.getAttribute('w:fldCharType') || ''
          if (fldCharType === 'begin') {
            const ffData = fldChar.getElementsByTagName('w:ffData')[0]
            if (ffData) {
              const controlElement = this.parseFfDataControl(ffData)
              if (controlElement) {
                elements.push(controlElement)
                inFormField = 'ff'
                continue
              }
            }
            continue
          }
          if (fldCharType === 'end') {
            inFormField = null
          }
          // begin/end/separate 本身不产生内容
          continue
        }
        if (inFormField === 'ff') {
          // 窗体域的缓存显示值（☐/选项文本等）不重复输出
          continue
        }
        elements.push(...this.parseRun(child, ctx, pStyleId))
      } else if (tag === 'w:sdt') {
        // 内容控件：优先映射为编辑器原生控件，非控件 sdt 提取内容文本
        const controlElement = this.parseSdtControl(child, ctx)
        if (controlElement) {
          elements.push(controlElement)
        } else {
          const sdtContent = elementChildren(child).find(
            el => el.tagName === 'w:sdtContent'
          )
          if (sdtContent) {
            elements.push(...this.parseSdtInlineRuns(sdtContent, ctx))
          }
        }
      } else if (tag === 'w:fldSimple') {
        for (const run of elementChildren(child)) {
          if (run.tagName === 'w:r') {
            elements.push(...this.parseRun(run, ctx, pStyleId))
          }
        }
      } else if (tag === 'w:hyperlink') {
        const runs = Array.from(child.getElementsByTagName('w:r'))
          .flatMap(run => this.parseRun(run, ctx, pStyleId))
          .filter(element => element.value !== '\n')
        const url = ctx.rels.external.get(child.getAttribute('r:id') || '')
        if (url && runs.length) {
          elements.push({
            value: '',
            type: ElementType.HYPERLINK,
            url,
            valueList: runs
          })
        } else {
          // 内部锚点无 url，降级为普通文本
          elements.push(...runs)
        }
      }
      // 书签/校对标记等跳过
    }
    return elements
  }

  private parseRun(
    run: Element,
    ctx: ZoneContext,
    pStyleId?: string
  ): IElement[] {
    const explicitRPr = run.getElementsByTagName('w:rPr')[0] || null
    const rStyleId = explicitRPr
      ?.getElementsByTagName('w:rStyle')[0]
      ?.getAttribute('w:val')
    // 样式优先级：docDefaults -> Normal 默认段落样式 -> 段落样式 -> 字符样式 -> 显式 rPr
    const style = mergeStyle(
      this.defaultRunStyle,
      this.defaultParagraphStyle || {},
      pStyleId ? this.styleRPrById.get(pStyleId) || {} : {},
      rStyleId ? this.styleRPrById.get(rStyleId) || {} : {},
      parseRPr(explicitRPr)
    )
    const elements: IElement[] = []
    for (const child of elementChildren(run)) {
      const tag = child.tagName
      if (tag === 'w:t') {
        const text = child.textContent || ''
        if (text) {
          const { verticalType, ...runStyle } = style
          elements.push({
            value: text,
            type:
              verticalType === 'superscript'
                ? ElementType.SUPERSCRIPT
                : verticalType === 'subscript'
                  ? ElementType.SUBSCRIPT
                  : ElementType.TEXT,
            ...runStyle
          })
        }
      } else if (tag === 'w:br') {
        if (child.getAttribute('w:type') === 'page') {
          elements.push({ value: '', type: ElementType.PAGE_BREAK })
        } else {
          appendLineBreak(elements, style)
        }
      } else if (tag === 'w:tab') {
        elements.push({ value: '', type: ElementType.TAB })
      } else if (tag === 'w:drawing' || tag === 'w:pict') {
        const image = this.parseDrawing(child, ctx)
        if (image) {
          elements.push(image)
        } else {
          const separator = this.parseVmlSeparator(child)
          if (separator) elements.push(separator)
        }
      } else if (tag === 'w:sdt' || tag === 'w:fldSimple') {
        // run 内内容控件 / 域：提取内容 runs
        const sdtContent = elementChildren(child).find(
          el => el.tagName === 'w:sdtContent'
        )
        const contentChildren = sdtContent
          ? elementChildren(sdtContent)
          : elementChildren(child)
        for (const inner of contentChildren) {
          if (inner.tagName === 'w:r') {
            elements.push(...this.parseRun(inner, ctx, pStyleId))
          }
        }
      }
    }
    return elements
  }

  // 内容控件（w:sdt）映射为编辑器原生控件：
  // w14:checkbox -> 复选框元素；dropDownList/comboBox -> 下拉控件；
  // date -> 日期控件；其余（含 w:text）-> 文本控件（浅蓝底纹样式由编辑器渲染）
  private parseSdtControl(sdt: Element, ctx: ZoneContext): IElement | null {
    const sdtPr = elementChildren(sdt).find(el => el.tagName === 'w:sdtPr')
    const sdtContent = elementChildren(sdt).find(
      el => el.tagName === 'w:sdtContent'
    )
    if (!sdtPr && !sdtContent) return null
    // 内容文本（当前值）
    const contentText = sdtContent
      ? Array.from(sdtContent.getElementsByTagName('w:t'))
          .map(t => t.textContent || '')
          .join('')
      : ''
    // 复选框内容控件
    const checkbox = sdtPr?.getElementsByTagName('w14:checkbox')[0]
    if (checkbox) {
      const checked = ['1', 'true'].includes(
        checkbox
          .getElementsByTagName('w14:checked')[0]
          ?.getAttribute('w14:val') || ''
      )
      return {
        value: '',
        type: ElementType.CHECKBOX,
        checkbox: { value: checked }
      }
    }
    // 下拉 / 组合框
    const dropDown =
      sdtPr?.getElementsByTagName('w:dropDownList')[0] ||
      sdtPr?.getElementsByTagName('w:comboBox')[0]
    if (dropDown) {
      const valueSets = Array.from(
        dropDown.getElementsByTagName('w:listItem')
      ).map(item => {
        const code = item.getAttribute('w:value') || ''
        return {
          value: item.getAttribute('w:displayText') || code,
          code
        }
      })
      const code =
        valueSets.find(set => set.value === contentText)?.code ||
        valueSets[0]?.code ||
        ''
      return this.buildControlShell({
        type: ControlType.SELECT,
        code,
        valueSets,
        value: [{ value: contentText }]
      })
    }
    // 日期选择器
    const date = sdtPr?.getElementsByTagName('w:date')[0]
    if (date) {
      const dateFormat =
        date.getAttribute('w:dateFormat')?.replace(/'/g, '') || undefined
      return this.buildControlShell({
        type: ControlType.DATE,
        ...(dateFormat ? { dateFormat } : {}),
        value: contentText ? [{ value: contentText }] : []
      })
    }
    // 富文本 / 纯文本控件：需有明确控件标记（w:text / w:richText）。
    // 内容型 sdt（文档部件 docPartObj、分组 group、图片 picture 等）
    // 不生成控件，交由上层按普通内容递归解析——否则页眉模板的
    // 外层 sdt 会把整个页眉内容包成一个控件
    if (
      !sdtPr?.getElementsByTagName('w:text').length &&
      !sdtPr?.getElementsByTagName('w:richText').length &&
      !sdtPr?.getElementsByTagName('w:number').length
    ) {
      return null
    }
    const contentElements = sdtContent
      ? this.parseSdtInlineRuns(sdtContent, ctx)
      : []
    return this.buildControlShell({
      type: ControlType.TEXT,
      value: contentElements.length
        ? contentElements
        : contentText
          ? [{ value: contentText, type: ElementType.TEXT }]
          : []
    })
  }

  // 旧式窗体域（w:ffData）：复选框 / 下拉 / 文本窗体 -> 编辑器控件
  private parseFfDataControl(ffData: Element): IElement | null {
    const checkBox = ffData.getElementsByTagName('w:checkBox')[0]
    if (checkBox) {
      const checkedElement = checkBox.getElementsByTagName('w:checked')[0]
      const checked =
        !!checkedElement &&
        !['0', 'false', 'off'].includes(
          checkedElement.getAttribute('w:val') || ''
        )
      return {
        value: '',
        type: ElementType.CHECKBOX,
        checkbox: { value: checked }
      }
    }
    const ddList = ffData.getElementsByTagName('w:ddList')[0]
    if (ddList) {
      const valueSets = Array.from(
        ddList.getElementsByTagName('w:listEntry')
      ).map(entry => ({
        value: entry.getAttribute('w:val') || '',
        code: entry.getAttribute('w:val') || ''
      }))
      const result = Number(
        ddList.getElementsByTagName('w:result')[0]?.getAttribute('w:val') || 0
      )
      const selected = valueSets[result] || valueSets[0]
      return this.buildControlShell({
        type: ControlType.SELECT,
        code: selected?.code || '',
        valueSets,
        value: selected ? [{ value: selected.value }] : []
      })
    }
    // 文本窗体：默认值
    const defaultText =
      ffData.getElementsByTagName('w:t')[0]?.getAttribute('w:val') || ''
    return this.buildControlShell({
      type: ControlType.TEXT,
      value: defaultText ? [{ value: defaultText }] : []
    })
  }

  private buildControlShell(control: object): IElement {
    return {
      value: '',
      type: ElementType.CONTROL,
      control: { id: generateControlId(), ...control }
    } as unknown as IElement
  }

  // 提取 sdtContent 的行内 runs（保留样式）
  private parseSdtInlineRuns(
    sdtContent: Element,
    ctx: ZoneContext
  ): IElement[] {
    const elements: IElement[] = []
    for (const child of elementChildren(sdtContent)) {
      if (child.tagName === 'w:p') {
        elements.push(...this.parseInlineContent(child, ctx))
      } else if (child.tagName === 'w:r') {
        elements.push(...this.parseRun(child, ctx))
      }
    }
    return elements.filter(el => el.value !== '\n')
  }

  // 图片：wp:inline 内联 / wp:anchor 浮动（含衬于文字下方、环绕）
  private parseDrawing(drawing: Element, ctx: ZoneContext): IElement | null {
    const blip = drawing.getElementsByTagName('a:blip')[0]
    const imgData = drawing.getElementsByTagName('v:imagedata')[0]
    // 水印 shape 不作为内容图片导入（由 parseWatermark 处理）
    const isWatermarkPict =
      imgData &&
      !blip &&
      (drawing.getElementsByTagName('v:textpath').length > 0 ||
        /watermark/i.test(
          drawing.getElementsByTagName('v:shape')[0]?.getAttribute('id') || ''
        ))
    if (isWatermarkPict) return null
    const rId =
      blip?.getAttribute('r:embed') || imgData?.getAttribute('r:id') || ''
    if (!rId) return null
    const path = ctx.rels.internal.get(rId)
    const cached = path ? this.imageCache.get(path) : null
    if (!path || !cached) return null
    // 尺寸：优先 wp:extent，其次 VML style（pt），最后按字节嗅探的原始尺寸
    const extent = drawing.getElementsByTagName('wp:extent')[0]
    let width = emuToPx(Number(extent?.getAttribute('cx') || 0))
    let height = emuToPx(Number(extent?.getAttribute('cy') || 0))
    if (!width || !height) {
      const shapeSize = style2WidthHeight(
        drawing.getElementsByTagName('v:shape')[0]
      )
      width = shapeSize.width || 0
      height = shapeSize.height || 0
    }
    if ((!width || !height) && cached.size) {
      width = cached.size.width
      height = cached.size.height
    }
    const image: IElement = {
      value: cached.dataUrl,
      type: ElementType.IMAGE,
      width: width || 100,
      height: height || 100
    }
    // 浮动定位
    const anchor = drawing.getElementsByTagName('wp:anchor')[0]
    if (anchor) {
      const behindDoc = anchor.getAttribute('behindDoc') === '1'
      const wrapElement =
        anchor.getElementsByTagName('wp:wrapSquare')[0] ||
        anchor.getElementsByTagName('wp:wrapTight')[0] ||
        anchor.getElementsByTagName('wp:wrapThrough')[0]
      const x = emuToPx(
        Number(
          anchor
            .getElementsByTagName('wp:positionH')[0]
            ?.getElementsByTagName('wp:posOffset')[0]?.textContent || 0
        )
      )
      const y = emuToPx(
        Number(
          anchor
            .getElementsByTagName('wp:positionV')[0]
            ?.getElementsByTagName('wp:posOffset')[0]?.textContent || 0
        )
      )
      image.imgDisplay = behindDoc
        ? ImageDisplay.FLOAT_BOTTOM
        : wrapElement
          ? ImageDisplay.SURROUND
          : ImageDisplay.FLOAT_TOP
      image.imgFloatPosition = { x, y }
    }
    return image
  }

  // 表格：tblGrid 列宽、行高、合并（gridSpan/vMerge）、边框、底纹、垂直对齐
  private parseTable(tbl: Element, ctx: ZoneContext): IElement {
    // 列宽：仅取直属 tblGrid
    const colgroup: { width: number }[] = []
    const tblGrid = elementChildren(tbl).find(
      child => child.tagName === 'w:tblGrid'
    )
    if (tblGrid) {
      for (const gridCol of elementChildren(tblGrid)) {
        if (gridCol.tagName === 'w:gridCol') {
          colgroup.push({
            width: twipToPx(parseDocxNumber(gridCol.getAttribute('w:w')))
          })
        }
      }
    }
    // 行/格（直属），展开逻辑属性
    const rows = elementChildren(tbl).filter(child => child.tagName === 'w:tr')
    interface LogicalCell {
      tc: Element
      colspan: number
      vMerge: 'restart' | 'continue' | null
    }
    const logicalRows: LogicalCell[][] = rows.map(tr =>
      elementChildren(tr)
        .filter(child => child.tagName === 'w:tc')
        .map(tc => {
          const colspan =
            parseDocxNumber(
              tc.getElementsByTagName('w:gridSpan')[0]?.getAttribute('w:val')
            ) || 1
          const vMergeElement = tc.getElementsByTagName('w:vMerge')[0]
          const vMerge = vMergeElement
            ? vMergeElement.getAttribute('w:val') === 'restart'
              ? 'restart'
              : 'continue'
            : null
          return { tc, colspan, vMerge }
        })
    )
    // 每行各格的起始网格列
    const gridStartCache = new Map<string, number>()
    const gridStartOf = (rowIndex: number, cellIndex: number): number => {
      const key = `${rowIndex}:${cellIndex}`
      const cached = gridStartCache.get(key)
      if (cached !== undefined) return cached
      let col = 0
      for (let c = 0; c < cellIndex; c++) {
        col += logicalRows[rowIndex][c].colspan
      }
      gridStartCache.set(key, col)
      return col
    }
    // restart 的 rowspan = 下方相同列位连续 continue 的行数 + 1
    const rowspanOf = (
      rowIndex: number,
      cellIndex: number,
      colspan: number
    ): number => {
      const startGrid = gridStartOf(rowIndex, cellIndex)
      let span = 1
      for (let r2 = rowIndex + 1; r2 < logicalRows.length; r2++) {
        let col = 0
        let matched: LogicalCell | null = null
        for (let c2 = 0; c2 < logicalRows[r2].length; c2++) {
          if (col === startGrid) {
            matched = logicalRows[r2][c2]
            break
          }
          col += logicalRows[r2][c2].colspan
        }
        if (matched?.vMerge === 'continue' && matched.colspan === colspan) {
          span++
        } else {
          break
        }
      }
      return span
    }
    const verticalAlignMap: Record<string, VerticalAlign> = {
      top: VerticalAlign.TOP,
      center: VerticalAlign.MIDDLE,
      bottom: VerticalAlign.BOTTOM
    }
    const trList: IElement['trList'] = []
    for (let r = 0; r < logicalRows.length; r++) {
      const tdList: NonNullable<IElement['trList']>[number]['tdList'] = []
      for (let c = 0; c < logicalRows[r].length; c++) {
        const cell = logicalRows[r][c]
        if (cell.vMerge === 'continue') continue
        const rowspan =
          cell.vMerge === 'restart' ? rowspanOf(r, c, cell.colspan) : 1
        const tcPr = cell.tc.getElementsByTagName('w:tcPr')[0] || null
        const tcW = parseDocxNumber(
          tcPr?.getElementsByTagName('w:tcW')[0]?.getAttribute('w:w')
        )
        const vAlign = tcPr
          ?.getElementsByTagName('w:vAlign')[0]
          ?.getAttribute('w:val')
        const backgroundColor = normalizeColor(
          tcPr?.getElementsByTagName('w:shd')[0]?.getAttribute('w:fill') ?? null
        )
        // 单元格边框（显式声明的边）
        const borderTypes: TdBorder[] = []
        const tcBorders = tcPr?.getElementsByTagName('w:tcBorders')[0]
        if (tcBorders) {
          const sides: [string, TdBorder][] = [
            ['w:top', TdBorder.TOP],
            ['w:right', TdBorder.RIGHT],
            ['w:bottom', TdBorder.BOTTOM],
            ['w:left', TdBorder.LEFT]
          ]
          for (const [xmlSide, side] of sides) {
            const val = tcBorders
              .getElementsByTagName(xmlSide)[0]
              ?.getAttribute('w:val')
            if (val && val !== 'nil' && val !== 'none') {
              borderTypes.push(side)
            }
          }
        }
        tdList.push({
          colspan: cell.colspan,
          rowspan,
          value: trimTrailingBreaks(this.parseBlockContainer(cell.tc, ctx)),
          ...(tcW ? { width: twipToPx(tcW) } : {}),
          ...(vAlign && verticalAlignMap[vAlign]
            ? { verticalAlign: verticalAlignMap[vAlign] }
            : {}),
          ...(backgroundColor ? { backgroundColor } : {}),
          ...(borderTypes.length ? { borderTypes } : {})
        })
      }
      const trHeight = parseDocxNumber(
        rows[r]
          .getElementsByTagName('w:trPr')[0]
          ?.getElementsByTagName('w:trHeight')[0]
          ?.getAttribute('w:val')
      )
      trList.push({
        height: trHeight ? twipToPx(trHeight) : 40,
        tdList
      })
    }
    return {
      value: '\n',
      type: ElementType.TABLE,
      ...(colgroup.length ? { colgroup } : {}),
      trList
    }
  }
}


// ====================================================================
// 导入入口
// =====================================================================

export default function (command: Command) {
  return async function (options: IImportDocxOption) {
    const { arrayBuffer, isAppend } = options
    const zip = await JSZip.loadAsync(arrayBuffer)
    const parser = new DocxParser(zip)
    const { watermark, pageSetup, disabledPages, ...data } =
      await parser.parse()
    // 追加模式：仅插入正文到文档末尾，不覆盖已有内容
    if (isAppend) {
      const commandAny = command as unknown as {
        executeInsertElementList?: (payload: IElement[]) => void
      }
      commandAny.executeInsertElementList?.(data.main || [])
      return
    }
    // 纸张/边距/方向/默认字体/水印 -> 编辑器配置
    // 注意：updateOptions 会将未传字段重置为默认值，需带上当前配置
    // 导入为整体替换语义：docx 无水印时显式清除编辑器已有水印
    const currentOptions = (command.getValue().options || {}) as Record<
      string,
      any
    >
    const hasCurrentWatermark = !!currentOptions.watermark?.data
    if (watermark || pageSetup || disabledPages || hasCurrentWatermark) {
      const commandAny = command as unknown as {
        executeUpdateOptions?: (payload: object) => void
        getValue: () => { options: object }
      }
      if (commandAny.executeUpdateOptions) {
        const update: Record<string, any> = {
          ...currentOptions,
          watermark: watermark || { data: '' },
          ...(pageSetup || {})
        }
        // 封面节无页眉/页脚时，编辑器首页禁用对应区域
        if (disabledPages?.header) {
          update.header = {
            ...(currentOptions.header || {}),
            disabledPages: disabledPages.header
          }
        }
        if (disabledPages?.footer) {
          update.footer = {
            ...(currentOptions.footer || {}),
            disabledPages: disabledPages.footer
          }
        }
        commandAny.executeUpdateOptions(update)
      }
    }
    command.executeSetValue(data)
  }
}
