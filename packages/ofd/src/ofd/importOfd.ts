import JSZip, { JSZipObject } from 'jszip'
import {
  Command,
  IElement,
  ElementType,
  PaperDirection
} from '@hufe921/canvas-editor'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeImportOfd(options: IImportOfdOption): void
  }
}

export interface IImportOfdOption {
  arrayBuffer: ArrayBuffer
  // 追加模式：导入内容插入到当前文档末尾，不覆盖已有内容
  isAppend?: boolean
}

// OFD 坐标单位 mm -> px
const PX_PER_MM = 96 / 25.4

function mmToPx(mm: number): number {
  return mm * PX_PER_MM
}

// ====================================================================
// XML 工具（命名空间前缀无关，按 localName 匹配）
// =====================================================================

function elementChildren(element: Element): Element[] {
  const children: Element[] = []
  for (let i = 0; i < element.childNodes.length; i++) {
    const node = element.childNodes[i]
    if (node.nodeType === 1) children.push(node as Element)
  }
  return children
}

function findChild(element: Element, tag: string): Element | null {
  return (
    elementChildren(element).find(child => child.localName === tag) || null
  )
}

function findDescendant(element: Element, tag: string): Element | null {
  for (const child of elementChildren(element)) {
    if (child.localName === tag) return child
    const found = findDescendant(child, tag)
    if (found) return found
  }
  return null
}

function elementText(element: Element | null): string {
  return element?.textContent?.trim() || ''
}

function parseXml(text: string): Element {
  const dom = new DOMParser().parseFromString(text, 'application/xml')
  if (dom.getElementsByTagName('parsererror').length) {
    throw new Error('ofd: XML 解析失败')
  }
  return dom.documentElement
}

// zip 相对路径拼接（base 所在目录 + 相对路径）
function joinZipPath(base: string, relative: string): string {
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/')) : ''
  return dir ? `${dir}/${relative}` : relative
}

async function readZipText(
  zip: JSZip,
  path: string
): Promise<string | null> {
  const file = zip.file(path)
  if (!file) return null
  return file.async('string')
}

// ====================================================================
// 数据模型
// =====================================================================

interface OfdFontDecl {
  fontName?: string
  familyName?: string
  bold?: boolean
  italic?: boolean
}

interface OfdMediaDecl {
  format: string
  path: string
}

// 文本片段：一个 TextCode 的绝对定位与样式
interface TextPiece {
  x: number
  baselineY: number
  size: number
  text: string
  family?: string
  bold?: boolean
  italic?: boolean
  color?: string
}

// 旋转文本（水印候选）
interface RotatedText {
  text: string
  color?: string
  alpha: number
  size: number
}

interface ImageBlock {
  x: number
  y: number
  element: IElement
}

// ====================================================================
// 解析
// =====================================================================

// 'r g b' / 'r g b a' -> '#rrggbb'；非彩色返回 undefined
function parseOfdColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const parts = value.trim().split(/[\s,]+/).map(p => parseInt(p, 10))
  if (parts.length < 3 || parts.slice(0, 3).some(n => isNaN(n))) return undefined
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`
}

// FontName/FamilyName -> 编辑器字体族
function mapOfdFontToFamily(
  fontName?: string,
  familyName?: string
): string | undefined {
  const f = `${fontName || ''} ${familyName || ''}`.toLowerCase()
  if (!f.trim()) return undefined
  if (f.includes('noto sans sc')) return 'Microsoft YaHei'
  if (f.includes('noto serif sc')) return 'SimSun'
  if (f.includes('simhei') || f.includes('黑体')) return 'SimHei'
  if (f.includes('simsun') || f.includes('宋体')) return 'SimSun'
  if (f.includes('kaiti') || f.includes('楷体')) return 'KaiTi'
  if (f.includes('fangsong') || f.includes('仿宋')) return 'FangSong'
  if (f.includes('yahei') || f.includes('雅黑')) return 'Microsoft YaHei'
  return familyName || fontName
}

const MIME_BY_FORMAT: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff'
}

async function parseImageElement(
  media: OfdMediaDecl | undefined,
  boundary: number[],
  zipFile: JSZipObject | null
): Promise<ImageBlock | null> {
  if (!media || !zipFile) return null
  const mime = MIME_BY_FORMAT[media.format.toLowerCase()]
  if (!mime) return null
  const base64 = await zipFile.async('base64')
  return {
    x: boundary[0],
    y: boundary[1],
    element: {
      type: ElementType.IMAGE,
      value: `data:${mime};base64,${base64}`,
      width: Math.round(boundary[2]),
      height: Math.round(boundary[3])
    }
  }
}

function parseBoundary(text: string): number[] {
  return text.trim().split(/[\s,]+/).map(v => parseFloat(v))
}

// 解析一页 Content.xml：文本片段、图片块、旋转文本
async function parsePageContent(
  zip: JSZip,
  pagePath: string,
  fonts: Map<string, OfdFontDecl>,
  mediaMap: Map<string, OfdMediaDecl>
): Promise<{
  pieces: TextPiece[]
  images: ImageBlock[]
  rotated: RotatedText[]
}> {
  const pieces: TextPiece[] = []
  const images: ImageBlock[] = []
  const rotated: RotatedText[] = []
  const text = await readZipText(zip, pagePath)
  const result = { pieces, images, rotated }
  if (!text) return result
  const root = parseXml(text)
  const objects: Element[] = []
  for (const layer of findDescendants(root, 'Layer')) {
    objects.push(...elementChildren(layer))
  }
  for (const obj of objects) {
    const boundary = parseBoundary(obj.getAttribute('Boundary') || '')
    if (boundary.length < 4 || boundary.some(v => isNaN(v))) continue
    const bx = mmToPx(boundary[0])
    const by = mmToPx(boundary[1])
    if (obj.localName === 'ImageObject') {
      const media = mediaMap.get(obj.getAttribute('ResourceID') || '')
      // media.path 已是完整 zip 路径（构造时做过相对路径拼接）
      const zipFile = media ? zip.file(media.path) : null
      const block = await parseImageElement(
        media,
        [bx, by, mmToPx(boundary[2]), mmToPx(boundary[3])],
        zipFile
      )
      if (block) {
        images.push(block)
      }
      continue
    }
    if (obj.localName !== 'TextObject') continue
    if (obj.getAttribute('Visible') === 'false') continue
    const textCode = findDescendant(obj, 'TextCode')
    if (!textCode || !textCode.textContent) continue
    const content = textCode.textContent
    const sizeMm = parseFloat(obj.getAttribute('Size') || '4.23')
    const size = Math.round(mmToPx(sizeMm))
    const fontDecl = fonts.get(obj.getAttribute('Font') || '')
    const fillEl = findDescendant(obj, 'FillColor')
    const color = parseOfdColor(fillEl?.getAttribute('Value'))
    const alphaAttr = obj.getAttribute('Alpha')
    const alpha = alphaAttr !== null ? parseInt(alphaAttr, 10) / 255 : 1
    const hasCtm = !!obj.getAttribute('CTM')
    if (hasCtm) {
      // 旋转文本：水印候选（角度装饰），不进入正文
      rotated.push({ text: content, color, alpha, size })
      continue
    }
    const codeX = mmToPx(parseFloat(textCode.getAttribute('X') || '0'))
    const codeY = mmToPx(parseFloat(textCode.getAttribute('Y') || '0'))
    const piece: TextPiece = {
      x: bx + codeX,
      baselineY: by + codeY,
      size,
      text: content,
      family: mapOfdFontToFamily(fontDecl?.fontName, fontDecl?.familyName),
      bold:
        fontDecl?.bold ||
        parseInt(obj.getAttribute('Weight') || '400', 10) >= 600,
      italic: fontDecl?.italic || obj.getAttribute('Italic') === 'true',
      color
    }
    pieces.push(piece)
  }
  return result
}

function findDescendants(element: Element, tag: string): Element[] {
  const result: Element[] = []
  const walk = (el: Element) => {
    for (const child of elementChildren(el)) {
      if (child.localName === tag) result.push(child)
      walk(child)
    }
  }
  walk(element)
  return result
}

// 行聚类：按基线 Y 聚成行，行内按 X 排序并合并同样式相邻片段
function clusterPiecesToLines(pieces: TextPiece[]): TextPiece[][] {
  const sorted = [...pieces].sort((a, b) => a.baselineY - b.baselineY)
  const lines: TextPiece[][] = []
  let currentLine: TextPiece[] = []
  let currentBaseY = 0
  let currentSize = 0
  for (const piece of sorted) {
    const tolerance = Math.max(2, piece.size * 0.35)
    if (
      currentLine.length &&
      Math.abs(piece.baselineY - currentBaseY) > tolerance
    ) {
      currentLine.sort((a, b) => a.x - b.x)
      lines.push(currentLine)
      currentLine = []
      currentSize = 0
    }
    currentLine.push(piece)
    currentBaseY = piece.baselineY
    currentSize = Math.max(currentSize, piece.size)
  }
  if (currentLine.length) {
    currentLine.sort((a, b) => a.x - b.x)
    lines.push(currentLine)
  }
  return lines
}

function lineToElements(line: TextPiece[]): IElement[] {
  const elements: IElement[] = []
  for (const piece of line) {
    const last = elements[elements.length - 1]
    if (
      last &&
      last.type === ElementType.TEXT &&
      !last.level &&
      last.font === piece.family &&
      last.size === piece.size &&
      !!last.bold === !!piece.bold &&
      !!last.italic === !!piece.italic &&
      last.color === piece.color
    ) {
      last.value += piece.text
    } else {
      elements.push({
        value: piece.text,
        font: piece.family,
        size: piece.size,
        bold: piece.bold || undefined,
        italic: piece.italic || undefined,
        color: piece.color
      })
    }
  }
  return elements
}

interface OfdParseResult {
  main: IElement[]
  header?: IElement[]
  footer?: IElement[]
  // 页码配置（format/disabled/bottom，或导出附件中的完整配置）
  pageNumberConfig?: Record<string, any>
  pageSetup?: {
    width: number
    height: number
    margins?: [number, number, number, number]
    paperDirection?: PaperDirection
  }
  headerOption?: Record<string, any>
  footerOption?: Record<string, any>
  // 默认字体/字号等（来自导出附件）
  defaults?: Record<string, any>
  watermark?: Record<string, any>
}

// 页面配置附件名（与导出端约定一致）
const PAGE_INFO_ATTACHMENT = 'canvas-editor.json'

// 页码行 -> 页码模板：'第 3 页' -> '第 {pageNo} 页'，
// '3 / 10' -> '{pageNo} / {pageCount}'；非页码行返回 null
function toPageNumberFormat(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 40 || !/\d/.test(trimmed)) return null
  let isFirst = true
  const format = trimmed.replace(/\d+/g, () => {
    if (isFirst) {
      isFirst = false
      return '{pageNo}'
    }
    return '{pageCount}'
  })
  if (!format.includes('{pageNo}')) return null
  // 出现重复占位符说明不是页码（如日期、编号）
  const countOf = (sub: string) => format.split(sub).length - 1
  if (countOf('{pageNo}') > 1 || countOf('{pageCount}') > 1) return null
  return format
}

async function parseOfdZip(zip: JSZip): Promise<OfdParseResult> {
  // OFD.xml -> DocRoot
  const ofdXmlText = await readZipText(zip, 'OFD.xml')
  if (!ofdXmlText) throw new Error('ofd: 缺少 OFD.xml（非有效的 OFD 文件）')
  const ofdRoot = parseXml(ofdXmlText)
  const docRootPath = elementText(findDescendant(ofdRoot, 'DocRoot'))
  if (!docRootPath) throw new Error('ofd: OFD.xml 中缺少 DocRoot')
  const documentPath = docRootPath.startsWith('/') ? docRootPath.slice(1) : docRootPath

  // Document.xml -> 页面与资源
  const documentText = await readZipText(zip, documentPath)
  if (!documentText) throw new Error(`ofd: 缺少 ${documentPath}`)
  const documentRoot = parseXml(documentText)
  const physicalBox = parseBoundary(
    elementText(findDescendant(documentRoot, 'PhysicalBox'))
  )
  const pageElements = findDescendants(documentRoot, 'Page')
  if (!pageElements.length) throw new Error('ofd: 文档中没有页面')

  // 资源文件路径（相对 Document.xml 所在目录）
  const publicResPath = elementText(
    findChild(findDescendant(documentRoot, 'CommonData') || documentRoot, 'PublicRes')
  )
  const documentResPath = elementText(
    findChild(findDescendant(documentRoot, 'CommonData') || documentRoot, 'DocumentRes')
  )

  // 字体表
  const fonts = new Map<string, OfdFontDecl>()
  if (publicResPath) {
    const resText = await readZipText(zip, joinZipPath(documentPath, publicResPath))
    if (resText) {
      const resRoot = parseXml(resText)
      for (const font of findDescendants(resRoot, 'Font')) {
        fonts.set(font.getAttribute('ID') || '', {
          fontName: font.getAttribute('FontName') || undefined,
          familyName: font.getAttribute('FamilyName') || undefined,
          bold: font.getAttribute('Bold') === 'true',
          italic: font.getAttribute('Italic') === 'true'
        })
      }
    }
  }

  // 图片资源表（MediaFile 相对 Res 目录）
  const mediaMap = new Map<string, OfdMediaDecl>()
  if (documentResPath) {
    const resPath = joinZipPath(documentPath, documentResPath)
    const resText = await readZipText(zip, resPath)
    if (resText) {
      const resRoot = parseXml(resText)
      const resDir = resRoot.getAttribute('BaseLoc') || 'Res'
      for (const media of findDescendants(resRoot, 'MultiMedia')) {
        const mediaFile = elementText(findChild(media, 'MediaFile'))
        if (!mediaFile) continue
        // resDir 相对 DocumentRes.xml 所在目录，MediaFile 相对 resDir；
        // 得到的已是完整 zip 路径，直接与文件名拼接
        const resDirPath = joinZipPath(resPath, resDir)
        mediaMap.set(media.getAttribute('ID') || '', {
          format: media.getAttribute('Format') || 'png',
          path: `${resDirPath}/${mediaFile}`
        })
      }
    }
  }

  // 逐页解析
  const main: IElement[] = []
  const allRotated: RotatedText[] = []
  let headerElements: IElement[] | null = null
  let footerElements: IElement[] | null = null
  let pageNumberFormat: string | null = null
  let pageNumberBaseline: number | null = null
  // 正文范围（用于无附件时的边距保守推断）
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let hasBody = false
  // 页眉/页脚分区阈值（比例）：仅当页面存在正文时剥离，
  // 避免把无正文页面的页码等内容误删
  const HEADER_RATIO = 0.06
  const FOOTER_RATIO = 0.88
  const pageHeightPx =
    physicalBox.length >= 4 && !isNaN(physicalBox[3])
      ? mmToPx(physicalBox[3])
      : 0
  for (let p = 0; p < pageElements.length; p++) {
    const baseLoc = pageElements[p].getAttribute('BaseLoc')
    if (!baseLoc) continue
    // BaseLoc 可能指向 Content.xml 或 Page.xml
    let contentPath = joinZipPath(documentPath, baseLoc)
    if (!zip.file(contentPath) && !baseLoc.endsWith('.xml')) {
      contentPath = `${contentPath}/Content.xml`
    }
    const page = await parsePageContent(zip, contentPath, fonts, mediaMap)
    allRotated.push(...page.rotated)
    const pageBlocks: { y: number; elements: IElement[] }[] = []
    const lines = clusterPiecesToLines(page.pieces)
    // 页眉/页脚候选：正文区之外的顶部/底部行
    const hasBodyLine = pageHeightPx
      ? lines.some(line => {
          const ratio = (line[0].baselineY - line[0].size) / pageHeightPx
          return ratio >= HEADER_RATIO && ratio <= FOOTER_RATIO
        })
      : true
    const headerLines: TextPiece[][] = []
    const footerLines: TextPiece[][] = []
    const bodyLines: TextPiece[][] = []
    if (hasBodyLine && pageHeightPx) {
      for (const line of lines) {
        const ratio = (line[0].baselineY - line[0].size) / pageHeightPx
        if (ratio < HEADER_RATIO) {
          headerLines.push(line)
        } else if (ratio > FOOTER_RATIO) {
          footerLines.push(line)
        } else {
          bodyLines.push(line)
        }
      }
    } else {
      bodyLines.push(...lines)
    }
    // 页眉/页脚只取首次出现的内容（多页重复），页码行还原为页码模板
    if (headerLines.length && !headerElements) {
      headerElements = []
      for (const line of headerLines) {
        headerElements.push(...lineToElements(line), { value: '\n' })
      }
    }
    for (const line of footerLines) {
      const text = line.map(piece => piece.text).join('').trim()
      const format = toPageNumberFormat(text)
      if (format) {
        if (!pageNumberFormat) {
          pageNumberFormat = format
          pageNumberBaseline = line[0].baselineY
        }
        continue
      }
      if (!footerElements) {
        footerElements = []
        for (const footerLine of footerLines) {
          const lineText = footerLine
            .map(piece => piece.text)
            .join('')
            .trim()
          if (toPageNumberFormat(lineText)) continue
          footerElements.push(...lineToElements(footerLine), { value: '\n' })
        }
      }
      break
    }
    let prevBottom = -Infinity
    let prevSize = 16
    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i]
      const lineElements = lineToElements(line)
      if (!lineElements.length) continue
      const top = line[0].baselineY - line[0].size
      const elements: IElement[] = []
      // 段落间距（明显大于行高） -> 空行分段
      if (
        pageBlocks.length &&
        top - prevBottom > Math.max(prevSize, line[0].size)
      ) {
        elements.push({ value: '\n' })
      }
      elements.push(...lineElements)
      pageBlocks.push({ y: top, elements })
      prevBottom = line[0].baselineY + line[0].size * 0.35
      prevSize = line[0].size
      hasBody = true
      for (const piece of line) {
        minX = Math.min(minX, piece.x)
        maxX = Math.max(maxX, piece.x + piece.text.length * piece.size * 0.62)
      }
      minY = Math.min(minY, top)
      maxY = Math.max(maxY, prevBottom)
    }
    for (const image of page.images) {
      pageBlocks.push({ y: image.y, elements: [image.element] })
      hasBody = true
      minX = Math.min(minX, image.x)
      maxX = Math.max(maxX, image.x + (image.element.width || 0))
      minY = Math.min(minY, image.y)
      maxY = Math.max(maxY, image.y + (image.element.height || 0))
    }
    pageBlocks.sort((a, b) => a.y - b.y)
    for (let i = 0; i < pageBlocks.length; i++) {
      main.push(...pageBlocks[i].elements)
      main.push({ value: '\n' })
    }
    // 非末页且有内容 -> 分页符
    if (p < pageElements.length - 1 && pageBlocks.length) {
      main.push({ type: ElementType.PAGE_BREAK, value: '' })
    }
  }
  if (main.length && main[main.length - 1].value === '\n') {
    main.pop()
  }

  const result: OfdParseResult = { main }
  if (headerElements?.length) result.header = headerElements
  if (footerElements?.length) result.footer = footerElements
  if (pageNumberFormat) {
    result.pageNumberConfig = {
      disabled: false,
      format: pageNumberFormat,
      ...(pageNumberBaseline !== null && pageHeightPx
        ? { bottom: Math.max(0, Math.round(pageHeightPx - pageNumberBaseline)) }
        : {})
    }
  } else {
    // 无页码：禁用编辑器页码，避免导入后显示残留页码
    result.pageNumberConfig = { disabled: true }
  }

  // 页面尺寸/方向（OFD 标准无边距信息）
  if (physicalBox.length >= 4 && !physicalBox.some(v => isNaN(v))) {
    result.pageSetup = {
      width: Math.round(mmToPx(physicalBox[2])),
      height: Math.round(mmToPx(physicalBox[3])),
      paperDirection:
        mmToPx(physicalBox[2]) > mmToPx(physicalBox[3])
          ? PaperDirection.HORIZONTAL
          : PaperDirection.VERTICAL
    }
  }

  // 旋转文本统一且半透明 -> 水印
  const uniqueRotated = [...new Set(allRotated.map(r => r.text))]
  if (uniqueRotated.length === 1 && allRotated.length) {
    const sample = allRotated[0]
    result.watermark = {
      data: sample.text,
      color: sample.color || '#AEB5C0',
      opacity: sample.alpha < 1 ? sample.alpha : 0.3,
      size: sample.size,
      font: 'Microsoft YaHei'
    }
  }

  // 页面配置附件（本插件导出时写入）：优先精确还原
  const pageInfo = await readPageInfoAttachment(zip, documentPath, documentRoot)
  if (pageInfo) {
    if (pageInfo.width && pageInfo.height) {
      result.pageSetup = {
        width: pageInfo.width,
        height: pageInfo.height,
        margins: pageInfo.margins,
        paperDirection: pageInfo.paperDirection
      }
    }
    if (pageInfo.pageNumber) {
      result.pageNumberConfig = { ...pageInfo.pageNumber }
    }
    if (pageInfo.header) result.headerOption = pageInfo.header
    if (pageInfo.footer) result.footerOption = pageInfo.footer
    if (
      pageInfo.defaultFont ||
      pageInfo.defaultSize ||
      pageInfo.defaultRowMargin
    ) {
      result.defaults = {
        ...(pageInfo.defaultFont ? { defaultFont: pageInfo.defaultFont } : {}),
        ...(pageInfo.defaultSize
          ? { defaultSize: pageInfo.defaultSize }
          : {}),
        ...(pageInfo.defaultRowMargin
          ? { defaultRowMargin: pageInfo.defaultRowMargin }
          : {}),
        ...(pageInfo.defaultBasicRowMarginHeight
          ? {
              defaultBasicRowMarginHeight:
                pageInfo.defaultBasicRowMarginHeight
            }
          : {})
      }
    }
    result.watermark =
      pageInfo.watermark && pageInfo.watermark.data
        ? pageInfo.watermark
        : { data: '' }
  } else if (hasBody && result.pageSetup && [minX, maxX, minY, maxY].every(v => isFinite(v))) {
    // 第三方 OFD：边距保守推断 —— 正文起点（上/左）可靠；
    // 下/右受内容是否满页影响，仅当覆盖过半时采用，否则用默认边距
    const { width, height } = result.pageSetup
    const clamp = (v: number, max: number) =>
      Math.max(0, Math.min(Math.round(v), Math.floor(max / 2)))
    result.pageSetup.margins = [
      clamp(minY, height),
      maxX > width * 0.55 ? clamp(width - maxX, width) : 120,
      maxY > height * 0.55 ? clamp(height - maxY, height) : 120,
      clamp(minX, width)
    ]
  }
  return result
}

// 读取页面配置附件（本插件导出时通过 addFileAsAttachment 写入）
async function readPageInfoAttachment(
  zip: JSZip,
  documentPath: string,
  documentRoot: Element
): Promise<Record<string, any> | null> {
  const attachmentsRef = elementText(
    findDescendant(documentRoot, 'Attachments')
  )
  if (!attachmentsRef) return null
  const attPath = joinZipPath(documentPath, attachmentsRef)
  const attText = await readZipText(zip, attPath)
  if (!attText) return null
  const attRoot = parseXml(attText)
  for (const attachment of findDescendants(attRoot, 'Attachment')) {
    if (attachment.getAttribute('Name') !== PAGE_INFO_ATTACHMENT) continue
    const fileLoc = elementText(findChild(attachment, 'FileLoc'))
    if (!fileLoc) continue
    const zipPath = fileLoc.startsWith('/')
      ? fileLoc.slice(1)
      : joinZipPath(attPath, fileLoc)
    const jsonText = await readZipText(zip, zipPath)
    if (!jsonText) continue
    try {
      const parsed = JSON.parse(jsonText)
      return typeof parsed === 'object' && parsed ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

// ====================================================================
// 导入入口
// =====================================================================

export default function (command: Command) {
  return async function (options: IImportOfdOption) {
    const { arrayBuffer, isAppend } = options
    const zip = await JSZip.loadAsync(arrayBuffer)
    const {
      main,
      header,
      footer,
      pageNumberConfig,
      pageSetup,
      headerOption,
      footerOption,
      defaults,
      watermark
    } = await parseOfdZip(zip)
    // 追加模式：仅插入正文到文档末尾，不覆盖已有内容
    if (isAppend) {
      const commandAny = command as unknown as {
        executeInsertElementList?: (payload: IElement[]) => void
      }
      commandAny.executeInsertElementList?.(main)
      return
    }
    // 页面尺寸/边距/方向/页眉/页脚/页码/默认字体/水印 -> 编辑器配置
    // 注意：updateOptions 会将未传字段重置为默认值，需带上当前配置
    const currentOptions = (command.getValue().options || {}) as Record<
      string,
      any
    >
    if (
      pageSetup ||
      watermark ||
      pageNumberConfig ||
      headerOption ||
      footerOption ||
      defaults ||
      currentOptions.watermark?.data
    ) {
      const commandAny = command as unknown as {
        executeUpdateOptions?: (payload: object) => void
      }
      if (commandAny.executeUpdateOptions) {
        const update: Record<string, any> = {
          ...currentOptions,
          watermark: watermark || { data: '' },
          ...(pageSetup || {}),
          ...(defaults || {})
        }
        if (pageNumberConfig) {
          update.pageNumber = {
            ...(currentOptions.pageNumber || {}),
            ...pageNumberConfig
          }
        }
        if (headerOption) {
          update.header = { ...(currentOptions.header || {}), ...headerOption }
        }
        if (footerOption) {
          update.footer = { ...(currentOptions.footer || {}), ...footerOption }
        }
        commandAny.executeUpdateOptions(update)
      }
    }
    const data: { main: IElement[]; header?: IElement[]; footer?: IElement[] } =
      { main }
    if (header) data.header = header
    if (footer) data.footer = footer
    command.executeSetValue(data)
  }
}
