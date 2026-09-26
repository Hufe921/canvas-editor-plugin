import jsOFD, { OutlineNode } from '@hufe921/jsofd'
import JSZip from 'jszip'
import {
  Editor,
  IElement,
  ElementType,
  ListStyle,
  NumberType,
  PaperDirection,
  RowFlex,
  TableBorder,
  TitleLevel,
  VerticalAlign,
  ImageDisplay
} from '@hufe921/canvas-editor'
import {
  CONTROL_PLACEHOLDER_COLOR,
  DEFAULT_PAGE_HEIGHT,
  DEFAULT_PAGE_MARGIN,
  DEFAULT_PAGE_WIDTH,
  DEFAULT_TAB_WIDTH,
  HYPERLINK_COLOR,
  PX_PER_PT,
  isCJKFontFamily,
  mapFontFamily,
  measureFontMetrics,
  normalizeColor,
  normalizeFontKey,
  normalizeFontStyle,
  numberToChinese,
  saveAs
} from './utils'
import { fetchFontUrl, registerDefaultEmbedFonts } from './embedFonts'

// ====================================================================
// jsofd 文档类型
// jsOFD 的 mixin 方法（setFont/text/rect 等）通过 `declare module '../jsofd'`
// 声明合并暴露，但发布产物 d.ts 中的自引用合并在消费侧不生效，
// 这里按官方类型定义显式声明插件用到的 API 子集
// =====================================================================

interface JsOfdTextOptions {
  fontSize?: number
  charSpace?: number
  align?: string
  baseline?: string
  angle?: number
}

interface JsOfdMixinApi {
  setProperties(properties: {
    title?: string
    subject?: string
    author?: string
    keywords?: string
    creator?: string
    creatorVersion?: string
  }): void
  addFontTtf(
    postScriptName: string,
    fontName: string,
    ttfData: Uint8Array,
    opts?: Record<string, unknown>
  ): string
  addFont(
    postScriptName: string,
    fontName: string,
    fontStyle?: string,
    opts?: Record<string, unknown>
  ): string
  putTotalPages(pageIndicator?: string): void
  setFont(fontName: string, fontStyle?: string): void
  setFontSize(size: number): void
  setTextColor(r: number | string, g?: number, b?: number): void
  setDrawColor(r: number | string, g?: number, b?: number): void
  setFillColor(r: number | string, g?: number, b?: number): void
  setLineWidth(width: number): void
  setLineDashPattern(dashArray: number[], dashPhase?: number): void
  setOpacity(opacity: number): void
  text(
    text: string | string[] | number,
    x: number,
    y: number,
    options?: JsOfdTextOptions
  ): void
  line(x1: number, y1: number, x2: number, y2: number, style?: string): void
  rect(x: number, y: number, w: number, h: number, style?: string): void
  circle(x: number, y: number, r: number, style?: string): void
  addImage(
    data: unknown,
    options: { x: number; y: number; w?: number; h?: number; format?: string }
  ): void
  svg(
    svgMarkup: string,
    options: { x: number; y: number; w?: number; h?: number }
  ): Promise<void>
  link(
    x: number,
    y: number,
    w: number,
    h: number,
    options?: { url?: string; pageNumber?: number }
  ): void
  getTextWidth(text: string): number
  getCharWidthsArray(
    text: string,
    options?: { fontSize?: number; charSpace?: number }
  ): number[]
  output(type?: string): unknown
  addFileAsAttachment(
    filename: string,
    data: string | Uint8Array | ArrayBuffer,
    options?: { format?: string; description?: string }
  ): void
}

type OfdDocument = jsOFD & JsOfdMixinApi

// ====================================================================
// 绘制中间模型
// =====================================================================

interface TextDrawRun {
  type: 'text'
  text: string
  family?: string
  size: number
  bold?: boolean
  italic?: boolean
  color?: string
  highlight?: string
  underline?: boolean
  strikeout?: boolean
  letterSpacing?: number
  script?: 'superscript' | 'subscript'
  url?: string
}

interface ImageDrawRun {
  type: 'image'
  value: string
  width: number
  height: number
}

interface LatexDrawRun {
  type: 'latex'
  value: string
  svg?: string
  width: number
  height: number
}

interface CheckboxDrawRun {
  type: 'checkbox'
  size: number
  checked: boolean
  radio: boolean
}

interface TabDrawRun {
  type: 'tab'
}

type DrawRun =
  | TextDrawRun
  | ImageDrawRun
  | LatexDrawRun
  | CheckboxDrawRun
  | TabDrawRun

interface DrawParagraph {
  type: 'paragraph'
  runs: DrawRun[]
  rowFlex?: RowFlex
  rowMargin?: number
  titleLevel?: TitleLevel
}

interface DrawTable {
  type: 'table'
  colgroup: { width: number }[]
  trList: {
    height: number
    tdList: {
      colspan: number
      rowspan: number
      value: IElement[]
      verticalAlign?: VerticalAlign
      backgroundColor?: string
    }[]
  }[]
  borderType?: TableBorder
  borderColor?: string
  borderWidth?: number
}

interface DrawSeparator {
  type: 'separator'
  color?: string
  dashArray?: number[]
  lineWidth?: number
}

interface DrawPageBreak {
  type: 'pageBreak'
}

interface DrawFloatImage {
  type: 'floatImage'
  value: string
  width: number
  height: number
  x: number
  y: number
}

type DrawBlock =
  | DrawParagraph
  | DrawTable
  | DrawSeparator
  | DrawPageBreak
  | DrawFloatImage

// ====================================================================
// 排版原子与行
// =====================================================================

interface TextAtom {
  kind: 'text'
  run: TextDrawRun
  text: string
  width: number
  ascent: number
  descent: number
}

interface EmbedAtom {
  kind: 'image' | 'latex' | 'checkbox'
  width: number
  height: number
  run: DrawRun
}

interface TabAtom {
  kind: 'tab'
  width: number
}

type Atom = TextAtom | EmbedAtom | TabAtom

interface LayoutLine {
  atoms: Atom[]
  width: number
  // 对齐用宽度（去除行尾空格）
  alignWidth: number
  ascent: number
  descent: number
  height: number
}

interface DrawLineParams {
  x: number
  y: number
  rowFlex?: RowFlex
  isLast: boolean
  maxWidth: number
}

// ====================================================================
// 导出上下文
// =====================================================================

interface FurnitureBlock {
  lines: LayoutLine[]
  rowFlex?: RowFlex
}

interface ExportContext {
  doc: OfdDocument
  pageWidth: number
  pageHeight: number
  contentLeft: number
  contentTop: number
  contentRight: number
  contentBottom: number
  contentWidth: number
  y: number
  pageNo: number
  defaultFont: string
  defaultSize: number
  defaultRowMargin: number
  basicRowMarginHeight: number
  watermark?: Record<string, any>
  pageNumber?: Record<string, any>
  // 页眉/页脚配置（top/bottom/disabled/disabledPages，跟随编辑器）
  headerOption?: Record<string, any>
  footerOption?: Record<string, any>
  // 已注册的自定义字体键（含嵌入与仅声明的未知字体），解析时优先于内置映射
  customFontFamilies: Set<string>
  headerBlocks: FurnitureBlock[]
  footerBlocks: FurnitureBlock[]
  outlines: { level: TitleLevel; text: string; pageNo: number }[]
}

// 字体键解析：自定义注册键优先，其次内置映射，最后兜底宋体
function resolveFontKey(
  ctx: ExportContext,
  family: string | undefined
): string {
  const key = normalizeFontKey(family || ctx.defaultFont || '')
  if (key && ctx.customFontFamilies.has(key)) return key
  return mapFontFamily(family, ctx.defaultFont) ?? 'simsun'
}

// 页码总数占位符：输出前替换为真实页数
const TOTAL_PAGES_PLACEHOLDER = '{pageCount}'

// 页面配置附件名：导出时写入，导入时优先读取以精确还原页面信息
const PAGE_INFO_ATTACHMENT = 'canvas-editor.json'

// 编辑器默认标题字号（canvas-editor defaultTitleOption）
const TITLE_SIZE_MAPPING: Record<TitleLevel, number> = {
  [TitleLevel.FIRST]: 26,
  [TitleLevel.SECOND]: 24,
  [TitleLevel.THIRD]: 22,
  [TitleLevel.FOURTH]: 20,
  [TitleLevel.FIFTH]: 18,
  [TitleLevel.SIXTH]: 16
}

// 编辑器行高公式（Draw.getElementRowMargin + computeRowList）：
// 行边距 = basicRowMarginHeight(8) × 字号系数 × 行距倍数
// 字号系数：12-30 为 1，小于 12 按比例缩小，大于 30 按比例放大
function rowMarginOf(
  size: number,
  rowMargin: number | undefined,
  ctx: ExportContext
): number {
  let ratio = 1
  if (size < 12) {
    ratio = size / 12
  } else if (size > 30) {
    ratio = 1 + (size - 30) / 30
  }
  return ctx.basicRowMarginHeight * ratio * (rowMargin ?? ctx.defaultRowMargin)
}

// ====================================================================
// 度量（水平：jsofd 字体表 —— 与写入 OFD 的逐字坐标一致；垂直：canvas）
// =====================================================================

function measureRunTextWidth(
  doc: OfdDocument,
  ctx: ExportContext,
  run: TextDrawRun,
  text: string
): number {
  if (!text) return 0
  doc.setFont(
    resolveFontKey(ctx, run.family),
    normalizeFontStyle(run.bold, run.italic)
  )
  const widthsPt = doc.getCharWidthsArray(text, {
    fontSize: run.size * PX_PER_PT,
    charSpace: 0
  })
  const scaleFactor = doc.scaleFactor
  let width = 0
  for (const w of widthsPt) {
    width += w / scaleFactor
  }
  width += (run.letterSpacing || 0) * Math.max(text.length - 1, 0)
  return width
}

function isWordChar(ch: string): boolean {
  // 可打印 ASCII（非空格）与不间断空格参与连词
  return (ch >= '!' && ch <= '~') || ch === '\u00A0'
}

function isCJKChar(ch: string): boolean {
  const code = ch.codePointAt(0) || 0
  return (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

function makeTextAtom(
  doc: OfdDocument,
  ctx: ExportContext,
  run: TextDrawRun,
  text: string,
  rowMargin: number | undefined
): TextAtom {
  const width = measureRunTextWidth(doc, ctx, run, text)
  const metrics = measureFontMetrics(run.family, run.size)
  const margin = rowMarginOf(run.size, rowMargin, ctx)
  let ascent = metrics.ascent + margin
  let descent = metrics.descent + margin
  // 上下标：缩小字号并整体上移/下移
  if (run.script === 'superscript') {
    ascent += run.size * 0.35
  } else if (run.script === 'subscript') {
    descent += run.size * 0.2
  }
  return { kind: 'text', run, text, width, ascent, descent }
}

function splitTextToAtoms(
  doc: OfdDocument,
  ctx: ExportContext,
  run: TextDrawRun,
  maxWidth: number,
  rowMargin: number | undefined
): Atom[] {
  if (!run.text) return []
  // 拆分断行单元：拉丁连续串为一个单元（尾部空格并入），
  // CJK/标点/空格为独立单元
  const units: string[] = []
  let buffer = ''
  for (const ch of run.text) {
    if (isWordChar(ch)) {
      buffer += ch
      continue
    }
    if (buffer) {
      units.push(buffer)
      buffer = ''
    }
    if (ch === ' ') {
      if (units.length) {
        units[units.length - 1] += ch
      } else {
        units.push(ch)
      }
    } else {
      units.push(ch)
    }
  }
  if (buffer) units.push(buffer)
  const atoms: Atom[] = []
  for (const unit of units) {
    const atom = makeTextAtom(doc, ctx, run, unit, rowMargin)
    // 超过行宽的不可断单元按字符硬拆
    if (atom.width > maxWidth && unit.length > 1 && !isCJKChar(unit[0])) {
      for (const ch of unit) {
        atoms.push(makeTextAtom(doc, ctx, run, ch, rowMargin))
      }
    } else {
      atoms.push(atom)
    }
  }
  return atoms
}

function paragraphRunsToAtoms(
  doc: OfdDocument,
  ctx: ExportContext,
  runs: DrawRun[],
  maxWidth: number,
  rowMargin: number | undefined
): Atom[] {
  const atoms: Atom[] = []
  for (const run of runs) {
    if (run.type === 'text') {
      atoms.push(...splitTextToAtoms(doc, ctx, run, maxWidth, rowMargin))
    } else if (run.type === 'tab') {
      atoms.push({ kind: 'tab', width: 0 })
    } else if (run.type === 'latex') {
      atoms.push({
        kind: 'latex',
        width: run.width,
        height: run.height,
        run
      })
    } else if (run.type === 'checkbox') {
      atoms.push({
        kind: 'checkbox',
        width: run.size,
        height: run.size,
        run
      })
    } else {
      atoms.push({
        kind: 'image',
        width: run.width,
        height: run.height,
        run
      })
    }
  }
  return atoms
}

function emptyLine(ctx: ExportContext): LayoutLine {
  const metrics = measureFontMetrics(ctx.defaultFont, ctx.defaultSize)
  const margin = rowMarginOf(ctx.defaultSize, undefined, ctx)
  return {
    atoms: [],
    width: 0,
    alignWidth: 0,
    ascent: metrics.ascent + margin,
    descent: metrics.descent + margin,
    height: metrics.ascent + metrics.descent + margin * 2
  }
}

function makeLine(
  atoms: Atom[],
  width: number,
  doc: OfdDocument,
  ctx: ExportContext
): LayoutLine {
  let ascent = 0
  let descent = 0
  for (const atom of atoms) {
    if (atom.kind === 'text') {
      ascent = Math.max(ascent, atom.ascent)
      descent = Math.max(descent, atom.descent)
    } else if (atom.kind === 'tab') {
      // ignore
    } else {
      ascent = Math.max(ascent, atom.height)
    }
  }
  // 行尾空格不参与对齐计算
  let alignWidth = width
  const last = atoms[atoms.length - 1]
  if (last && last.kind === 'text') {
    const trailing = last.text.match(/[\s\u00A0]+$/)
    if (trailing) {
      const trailingWidth = measureRunTextWidth(doc, ctx, last.run, trailing[0])
      alignWidth = width - trailingWidth
    }
  }
  return { atoms, width, alignWidth, ascent, descent, height: ascent + descent }
}

function layoutParagraphToLines(
  doc: OfdDocument,
  ctx: ExportContext,
  paragraph: DrawParagraph,
  maxWidth: number
): LayoutLine[] {
  const atoms = paragraphRunsToAtoms(
    doc,
    ctx,
    paragraph.runs,
    maxWidth,
    paragraph.rowMargin
  )
  if (!atoms.length) return [emptyLine(ctx)]
  const lines: LayoutLine[] = []
  let current: Atom[] = []
  let currentWidth = 0
  const closeLine = () => {
    if (!current.length) return
    lines.push(makeLine(current, currentWidth, doc, ctx))
    current = []
    currentWidth = 0
  }
  for (const atom of atoms) {
    // TAB：推进到下一个制表位（相对行起点）
    if (atom.kind === 'tab') {
      atom.width = Math.max(
        4,
        Math.ceil((currentWidth + 0.1) / DEFAULT_TAB_WIDTH) *
          DEFAULT_TAB_WIDTH -
          currentWidth
      )
    }
    const canBreak =
      current.length === 0 ||
      atom.kind !== 'text' ||
      !/^[\s\u00A0]/.test(atom.text)
    if (
      currentWidth + atom.width > maxWidth + 0.5 &&
      current.length &&
      canBreak
    ) {
      closeLine()
    }
    current.push(atom)
    currentWidth += atom.width
  }
  closeLine()
  return lines.length ? lines : [emptyLine(ctx)]
}

// ====================================================================
// 元素 -> 绘制运行
// =====================================================================

function elementToTextRun(element: IElement, ctx: ExportContext): TextDrawRun {
  const type = element.type
  return {
    type: 'text',
    text: element.value ?? '',
    family: element.font,
    size: element.size || ctx.defaultSize,
    bold: element.bold,
    italic: element.italic,
    color: normalizeColor(element.color),
    highlight: normalizeColor(element.highlight),
    underline: element.underline,
    strikeout: element.strikeout,
    letterSpacing: element.letterSpacing,
    script:
      type === ElementType.SUPERSCRIPT
        ? 'superscript'
        : type === ElementType.SUBSCRIPT
          ? 'subscript'
          : undefined
  }
}

function elementToRuns(
  element: IElement,
  ctx: ExportContext,
  checkboxIndex: Map<string, number>
): DrawRun[] {
  const type = element.type
  // 控件组件（编辑器实时数据形态）
  if (
    element.controlComponent === 'checkbox' ||
    element.controlComponent === 'radio'
  ) {
    const control: any = element.control
    const valueSets: any[] = control?.valueSets || []
    const index = checkboxIndex.get(element.controlId || '') || 0
    checkboxIndex.set(element.controlId || '', index + 1)
    const valueSet = valueSets[index]
    const checked = valueSet
      ? String(control?.code || '')
          .split(',')
          .includes(valueSet.code)
      : false
    return [
      {
        type: 'checkbox',
        checked,
        radio: element.controlComponent === 'radio',
        size: element.size || 14
      }
    ]
  }
  if (element.controlComponent === 'placeholder') {
    return [
      {
        type: 'text',
        text: element.value || '',
        family: element.font,
        size: element.size || ctx.defaultSize,
        color: CONTROL_PLACEHOLDER_COLOR
      }
    ]
  }
  if (type === ElementType.IMAGE) {
    return [
      {
        type: 'image',
        value: element.value,
        width: element.width || 100,
        height: element.height || 100
      }
    ]
  }
  if (type === ElementType.TAB) {
    return [{ type: 'tab' }]
  }
  if (type === ElementType.LATEX) {
    return [
      {
        type: 'latex',
        value: element.value,
        svg: element.laTexSVG,
        width: element.width || 100,
        height: element.height || 30
      }
    ]
  }
  if (type === ElementType.CHECKBOX || type === ElementType.RADIO) {
    return [
      {
        type: 'checkbox',
        checked: !!element.checkbox?.value,
        radio: type === ElementType.RADIO,
        size: element.size || 14
      }
    ]
  }
  return [elementToTextRun(element, ctx)]
}

// 压缩控件元素（getValue 经 zipElementList 后的形态）-> 绘制运行
function controlToRuns(
  element: IElement,
  ctx: ExportContext,
  checkboxIndex: Map<string, number>
): DrawRun[] {
  const control: any = element.control
  if (!control) return []
  const size = element.size || ctx.defaultSize
  const family = element.font
  const prefix = control.prefix ?? '{'
  const postfix = control.postfix ?? '}'
  const valueSets: any[] = control.valueSets || []
  // 控件值区域下划线（签名线样式：值/占位/空白撑位均带下划线）
  const isUnderline = control.underline === true
  const runs: DrawRun[] = []
  if (
    (control.type === 'checkbox' || control.type === 'radio') &&
    valueSets.length
  ) {
    const codes = String(control.code || '').split(',')
    for (const valueSet of valueSets) {
      runs.push({
        type: 'checkbox',
        checked:
          control.type === 'radio'
            ? control.code === valueSet.code
            : codes.includes(valueSet.code),
        radio: control.type === 'radio',
        size: Math.min(size, 14)
      })
      runs.push({ type: 'text', text: valueSet.value, family, size })
    }
    return runs
  }
  runs.push({ type: 'text', text: prefix, family, size })
  const valueList: IElement[] = control.value || []
  if (valueList.length) {
    for (const valueElement of valueList) {
      for (const run of elementToRuns(valueElement, ctx, checkboxIndex)) {
        if (run.type === 'text' && isUnderline) {
          run.underline = true
        }
        runs.push(run)
      }
    }
  } else if (control.placeholder) {
    runs.push({
      type: 'text',
      text: control.placeholder,
      family,
      size,
      color: CONTROL_PLACEHOLDER_COLOR,
      underline: isUnderline || undefined
    })
  } else if (isUnderline) {
    // 空值签名线：按 minWidth 输出下划线空白
    const minWidth = control.minWidth || 0
    const spaceCount = minWidth ? Math.ceil(minWidth / (size / 2)) : 0
    if (spaceCount > 0) {
      runs.push({
        type: 'text',
        text: '\u00A0'.repeat(spaceCount),
        family,
        size,
        underline: true
      })
    }
  }
  runs.push({ type: 'text', text: postfix, family, size })
  return runs
}

function getListMarker(
  listStyle: ListStyle | undefined,
  index: number
): string {
  switch (listStyle) {
    case ListStyle.CIRCLE:
      return '○'
    case ListStyle.SQUARE:
      return '■'
    case ListStyle.CHECKBOX:
      return '□'
    case ListStyle.DECIMAL:
      return `${index + 1}.`
    default:
      return '•'
  }
}

// ====================================================================
// 元素列表 -> 绘制块
// =====================================================================

const BLOCK_ELEMENT_TYPES = [
  ElementType.TITLE,
  ElementType.LIST,
  ElementType.TABLE,
  ElementType.SEPARATOR,
  ElementType.PAGE_BREAK
]

function parseElementListToBlocks(
  elementList: IElement[],
  ctx: ExportContext
): DrawBlock[] {
  const blocks: DrawBlock[] = []
  const checkboxIndex = new Map<string, number>()
  let current: DrawParagraph | null = null

  const closeParagraph = (force?: boolean) => {
    if (current && (current.runs.length || force)) {
      blocks.push(current)
    }
    current = null
  }
  const openParagraph = (element?: IElement) => {
    if (!current) {
      current = {
        type: 'paragraph',
        runs: [],
        rowFlex: element?.rowFlex,
        rowMargin: element?.rowMargin
      }
    }
  }

  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]
    const type = element.type

    if (type === ElementType.TITLE) {
      closeParagraph()
      const level = element.level || TitleLevel.FIRST
      const runs: DrawRun[] = []
      for (const child of element.valueList || []) {
        for (const run of elementToRuns(child, ctx, checkboxIndex)) {
          // 标题字号兜底：子元素未设置字号时按标题级别取默认字号
          if (run.type === 'text' && !child.size) {
            run.size = TITLE_SIZE_MAPPING[level]
          }
          runs.push(run)
        }
      }
      blocks.push({
        type: 'paragraph',
        runs,
        rowFlex: element.rowFlex,
        rowMargin: element.rowMargin,
        titleLevel: level
      })
      continue
    }

    if (type === ElementType.LIST) {
      closeParagraph()
      const listText = (element.valueList || [])
        .map(item => item.value)
        .join('')
      const lines = listText
        .split('\n')
        .filter((text, i) => i !== 0 || text !== '')
      const indent = '　'.repeat((element.listLevel || 0) * 2)
      lines.forEach((text, index) => {
        const size = element.size || ctx.defaultSize
        blocks.push({
          type: 'paragraph',
          runs: [
            {
              type: 'text',
              text: `${indent}${getListMarker(element.listStyle, index)} `,
              family: element.font,
              size,
              bold: element.bold
            },
            ...elementToRuns(
              { ...element, value: text },
              ctx,
              checkboxIndex
            ).filter(run => run.type === 'text')
          ],
          rowFlex: element.rowFlex,
          rowMargin: element.rowMargin
        })
      })
      continue
    }

    if (type === ElementType.TABLE) {
      closeParagraph()
      blocks.push({
        type: 'table',
        colgroup: (element.colgroup || []) as { width: number }[],
        trList: (element.trList || []) as DrawTable['trList'],
        borderType: element.borderType,
        borderColor: element.borderColor,
        borderWidth: element.borderWidth
      })
      continue
    }

    if (type === ElementType.SEPARATOR) {
      closeParagraph()
      blocks.push({
        type: 'separator',
        color: element.color,
        dashArray: element.dashArray,
        lineWidth: element.lineWidth
      })
      continue
    }

    if (type === ElementType.PAGE_BREAK) {
      closeParagraph()
      blocks.push({ type: 'pageBreak' })
      continue
    }

    if (type === ElementType.IMAGE) {
      const isFloat =
        element.imgDisplay === ImageDisplay.FLOAT_TOP ||
        element.imgDisplay === ImageDisplay.FLOAT_BOTTOM
      if (isFloat) {
        closeParagraph()
        blocks.push({
          type: 'floatImage',
          value: element.value,
          width: element.width || 100,
          height: element.height || 100,
          x: element.imgFloatPosition?.x || 0,
          y: element.imgFloatPosition?.y || 0
        })
      } else {
        openParagraph(element)
        current!.runs.push(...elementToRuns(element, ctx, checkboxIndex))
      }
      continue
    }

    if (type === ElementType.HYPERLINK) {
      openParagraph(element)
      for (const child of element.valueList || []) {
        for (const run of elementToRuns(child, ctx, checkboxIndex)) {
          if (run.type === 'text') {
            run.url = element.url
            if (!run.color) {
              run.color = HYPERLINK_COLOR
              run.underline = true
            } else if (run.underline === undefined) {
              run.underline = true
            }
          }
          current!.runs.push(run)
        }
      }
      continue
    }

    if (type === ElementType.CONTROL && element.control) {
      // 压缩控件：与前置文本同段，控件结束后换段
      openParagraph(element)
      current!.runs.push(...controlToRuns(element, ctx, checkboxIndex))
      closeParagraph(true)
      continue
    }

    if (type === ElementType.DATE) {
      openParagraph(element)
      for (const child of element.valueList || []) {
        current!.runs.push(...elementToRuns(child, ctx, checkboxIndex))
      }
      continue
    }

    // 普通文本：控件边界断行 + 按 \n 拆段
    const prevControlId = elementList[e - 1]?.controlId
    if (prevControlId && prevControlId !== element.controlId) {
      closeParagraph()
    }
    let value = element.value ?? ''
    if (/^\n/.test(value)) {
      // 控件行尾 \n 的换行职责可能已被控件边界断行履行，避免重复空段
      const prevIsControlEnd = !!elementList[e - 1]?.controlId
      closeParagraph()
      value = value.replace(/^\n/, '')
      if (prevIsControlEnd && !value) continue
    }
    // 下一元素为块级时去掉尾部换行，避免标题/表格等前面多出空行
    const nextElement = elementList[e + 1]
    const isNextBlockElement =
      nextElement?.type !== undefined &&
      BLOCK_ELEMENT_TYPES.includes(nextElement.type)
    const normalized = isNextBlockElement ? value.replace(/\n$/, '') : value
    const segments = normalized.split('\n')
    let lastNonEmptyIndex = -1
    for (let i = 0; i < segments.length; i++) {
      if (segments[i]) lastNonEmptyIndex = i
    }
    const isComponentElement =
      element.controlComponent === 'checkbox' ||
      element.controlComponent === 'radio' ||
      type === ElementType.CHECKBOX ||
      type === ElementType.TAB
    for (let s = 0; s < segments.length; s++) {
      const segment = segments[s]
      if (s > 0) closeParagraph(true)
      if (segment || (s === 0 && isComponentElement) || s < lastNonEmptyIndex) {
        openParagraph(element)
        current!.runs.push(
          ...elementToRuns({ ...element, value: segment }, ctx, checkboxIndex)
        )
      }
    }
  }
  closeParagraph()
  return blocks
}

// ====================================================================
// 绘制：文本段
// =====================================================================

async function drawTextSegment(
  doc: OfdDocument,
  ctx: ExportContext,
  run: TextDrawRun,
  text: string,
  x: number,
  baseline: number,
  width: number
) {
  if (!text) return
  const color = run.color || '#000000'
  let size = run.size
  let baselineY = baseline
  if (run.script === 'superscript') {
    size *= 0.66
    baselineY = baseline - run.size * 0.35
  } else if (run.script === 'subscript') {
    size *= 0.66
    baselineY = baseline + run.size * 0.2
  }
  const metrics = measureFontMetrics(run.family, run.size)
  // 高亮背景
  if (run.highlight) {
    doc.setFillColor(run.highlight)
    doc.rect(
      x,
      baselineY - metrics.ascent - 1,
      width,
      metrics.ascent + metrics.descent + 2,
      'F'
    )
  }
  doc.setFont(
    resolveFontKey(ctx, run.family),
    normalizeFontStyle(run.bold, run.italic)
  )
  doc.setTextColor(color)
  doc.text(text, x, baselineY, {
    fontSize: size * PX_PER_PT,
    ...(run.letterSpacing ? { charSpace: run.letterSpacing } : {})
  })
  const decorationWidth = Math.max(0.6, size / 20)
  if (run.underline) {
    doc.setDrawColor(color)
    doc.setLineWidth(decorationWidth)
    const uy = baselineY + Math.max(1.5, metrics.descent * 0.8)
    doc.line(x, uy, x + width, uy)
  }
  if (run.strikeout) {
    doc.setDrawColor(color)
    doc.setLineWidth(decorationWidth)
    const sy = baselineY - metrics.ascent * 0.45 + metrics.descent * 0.1
    doc.line(x, sy, x + width, sy)
  }
  if (run.url) {
    doc.link(
      x,
      baselineY - metrics.ascent - 1,
      width,
      metrics.ascent + metrics.descent + 2,
      {
        url: run.url
      }
    )
  }
}

function drawCheckboxRun(
  doc: OfdDocument,
  x: number,
  baseline: number,
  run: CheckboxDrawRun
) {
  const size = run.size
  const top = baseline - size
  doc.setDrawColor('#000000')
  doc.setLineWidth(0.8)
  if (run.radio) {
    doc.circle(x + size / 2, baseline - size / 2, size / 2, 'S')
    if (run.checked) {
      doc.setFillColor('#000000')
      doc.circle(x + size / 2, baseline - size / 2, size * 0.22, 'F')
    }
    return
  }
  doc.rect(x, top, size, size, 'S')
  if (run.checked) {
    // 勾选标记（两段折线）
    doc.setLineWidth(1.1)
    doc.line(
      x + size * 0.18,
      top + size * 0.55,
      x + size * 0.42,
      top + size * 0.78
    )
    doc.line(
      x + size * 0.42,
      top + size * 0.78,
      x + size * 0.82,
      top + size * 0.24
    )
  }
}

async function drawEmbedAtom(
  doc: OfdDocument,
  atom: EmbedAtom,
  x: number,
  baseline: number
) {
  if (atom.kind === 'image') {
    const run = atom.run as ImageDrawRun
    doc.addImage(run.value, {
      x,
      y: baseline - atom.height,
      w: atom.width,
      h: atom.height
    })
    return
  }
  if (atom.kind === 'latex') {
    const run = atom.run as LatexDrawRun
    if (run.svg) {
      try {
        await doc.svg(run.svg, {
          x,
          y: baseline - atom.height,
          w: atom.width,
          h: atom.height
        })
        return
      } catch {
        // 浏览器不支持时退化为文本
      }
    }
    doc.setFont('courier', 'normal')
    doc.setTextColor('#000000')
    doc.text(run.value, x, baseline, {
      fontSize: (atom.height || 30) * PX_PER_PT
    })
    return
  }
  drawCheckboxRun(doc, x, baseline, atom.run as CheckboxDrawRun)
}

async function drawLayoutLine(
  doc: OfdDocument,
  ctx: ExportContext,
  line: LayoutLine,
  params: DrawLineParams
) {
  if (!line.atoms.length) return
  const baseline = params.y + line.ascent
  const extra = params.maxWidth - line.alignWidth
  const isJustify =
    (params.rowFlex === RowFlex.ALIGNMENT ||
      params.rowFlex === RowFlex.JUSTIFY) &&
    !params.isLast &&
    line.atoms.length > 1 &&
    extra > 1
  let cursorX = params.x
  if (!isJustify) {
    if (params.rowFlex === RowFlex.CENTER) {
      cursorX = params.x + extra / 2
    } else if (params.rowFlex === RowFlex.RIGHT) {
      cursorX = params.x + extra
    }
  }
  const gap = isJustify ? extra / (line.atoms.length - 1) : 0
  // 非 justify 时合并相邻同源文本段，减少对象数
  let mergeRun: TextDrawRun | null = null
  let mergeText = ''
  let mergeStartX = cursorX
  let mergeWidth = 0
  const flushMerge = async () => {
    if (mergeRun && mergeText) {
      await drawTextSegment(
        doc,
        ctx,
        mergeRun,
        mergeText,
        mergeStartX,
        baseline,
        mergeWidth
      )
    }
    mergeRun = null
    mergeText = ''
    mergeWidth = 0
  }
  for (const atom of line.atoms) {
    if (atom.kind === 'tab') {
      await flushMerge()
      cursorX += atom.width
      continue
    }
    if (atom.kind === 'text') {
      if (isJustify) {
        await flushMerge()
        await drawTextSegment(
          doc,
          ctx,
          atom.run,
          atom.text,
          cursorX,
          baseline,
          atom.width
        )
      } else if (mergeRun === atom.run) {
        mergeText += atom.text
        mergeWidth += atom.width
      } else {
        await flushMerge()
        mergeRun = atom.run
        mergeText = atom.text
        mergeWidth = atom.width
        mergeStartX = cursorX
      }
    } else {
      await flushMerge()
      await drawEmbedAtom(doc, atom, cursorX, baseline)
    }
    cursorX += atom.width + (isJustify ? gap : 0)
  }
  await flushMerge()
}

// ====================================================================
// 绘制：段落
// =====================================================================

function paragraphText(paragraph: DrawParagraph): string {
  return paragraph.runs
    .map(run => (run.type === 'text' ? run.text : ''))
    .join('')
    .trim()
}

async function drawParagraph(
  doc: OfdDocument,
  ctx: ExportContext,
  paragraph: DrawParagraph
) {
  const lines = layoutParagraphToLines(doc, ctx, paragraph, ctx.contentWidth)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    await ensureSpace(ctx, line.height)
    if (i === 0 && paragraph.titleLevel !== undefined) {
      const text = paragraphText(paragraph)
      if (text) {
        ctx.outlines.push({
          level: paragraph.titleLevel,
          text,
          pageNo: ctx.pageNo
        })
      }
    }
    await drawLayoutLine(doc, ctx, line, {
      x: ctx.contentLeft,
      y: ctx.y,
      rowFlex: paragraph.rowFlex,
      isLast: i === lines.length - 1,
      maxWidth: ctx.contentWidth
    })
    ctx.y += line.height
  }
}

// ====================================================================
// 绘制：表格
// =====================================================================

interface CellPlan {
  rowStart: number
  colStart: number
  rowspan: number
  colspan: number
  value: IElement[]
  backgroundColor?: string
  verticalAlign?: VerticalAlign
  contentHeight: number
  paragraphs: { paragraph: DrawParagraph; lines: LayoutLine[] }[]
}

async function drawTableBlock(
  doc: OfdDocument,
  ctx: ExportContext,
  table: DrawTable
) {
  const trList = table.trList
  const colgroup = table.colgroup
  if (!trList.length || !colgroup.length) return
  const rawWidths = colgroup.map(col => col.width || 0)
  const rawTotal = rawWidths.reduce((sum, w) => sum + w, 0)
  const scale = rawTotal > ctx.contentWidth ? ctx.contentWidth / rawTotal : 1
  const colWidths = rawWidths.map(w => w * scale)
  const colXs: number[] = [ctx.contentLeft]
  for (const w of colWidths) {
    colXs.push(colXs[colXs.length - 1] + w)
  }
  const rowCount = trList.length
  const colCount = colgroup.length

  // 占位网格：解析单元格实际位置（colspan/rowspan）
  const occupied: boolean[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: colCount }, () => false)
  )
  const cells: CellPlan[] = []
  for (let r = 0; r < rowCount; r++) {
    for (const td of trList[r].tdList) {
      let c = 0
      while (c < colCount && occupied[r][c]) c++
      if (c >= colCount) continue
      const colspan = Math.min(Math.max(td.colspan || 1, 1), colCount - c)
      const rowspan = Math.min(Math.max(td.rowspan || 1, 1), rowCount - r)
      for (let i = 0; i < rowspan; i++) {
        for (let j = 0; j < colspan; j++) {
          occupied[r + i][c + j] = true
        }
      }
      cells.push({
        rowStart: r,
        colStart: c,
        rowspan,
        colspan,
        value: td.value || [],
        backgroundColor: td.backgroundColor,
        verticalAlign: td.verticalAlign,
        contentHeight: 0,
        paragraphs: []
      })
    }
  }

  // 单元格内容布局（单元格内仅取段落，忽略嵌套表格等复杂块）
  for (const cell of cells) {
    const cellWidth = colXs[cell.colStart + cell.colspan] - colXs[cell.colStart]
    const blocks = parseElementListToBlocks(cell.value, ctx)
    let contentHeight = 0
    for (const block of blocks) {
      if (block.type !== 'paragraph') continue
      const lines = layoutParagraphToLines(doc, ctx, block, cellWidth)
      cell.paragraphs.push({ paragraph: block, lines })
      contentHeight += lines.reduce((sum, line) => sum + line.height, 0)
    }
    cell.contentHeight = Math.max(contentHeight, 0)
  }

  // 行高：先按 rowspan=1 单元格撑开，再按跨行单元格补差
  const rowHeights = trList.map(tr => tr.height || 0)
  for (const cell of cells) {
    if (cell.rowspan === 1) {
      rowHeights[cell.rowStart] = Math.max(
        rowHeights[cell.rowStart],
        cell.contentHeight
      )
    }
  }
  for (const cell of cells) {
    if (cell.rowspan > 1) {
      let spanned = 0
      for (let i = 0; i < cell.rowspan; i++) {
        spanned += rowHeights[cell.rowStart + i]
      }
      if (cell.contentHeight > spanned) {
        rowHeights[cell.rowStart + cell.rowspan - 1] +=
          cell.contentHeight - spanned
      }
    }
  }

  // 行分组：rowspan 跨行的行保持同页
  const groupEndOf: number[] = []
  for (let r = 0; r < rowCount; r++) {
    let end = r + 1
    while (end < rowCount) {
      const crossing = cells.some(
        cell => cell.rowStart < end && cell.rowStart + cell.rowspan > end
      )
      if (crossing) end++
      else break
    }
    groupEndOf[r] = end
  }

  const borderColor = normalizeColor(table.borderColor) || '#000000'
  const borderWidth = table.borderWidth || 1

  const drawTableBorders = (
    cell: CellPlan,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number,
    isFirstRowOfChunk: boolean,
    isLastRowOfChunk: boolean,
    dash: boolean
  ) => {
    doc.setDrawColor(borderColor)
    doc.setLineWidth(borderWidth)
    if (dash) {
      doc.setLineDashPattern([3, 2], 0)
    }
    switch (table.borderType) {
      case TableBorder.EMPTY:
        break
      case TableBorder.EXTERNAL:
        break
      case TableBorder.INTERNAL: {
        // 仅内部边框：跳过分块边界上的边
        if (!isFirstRowOfChunk) {
          doc.line(cellX, cellY, cellX + cellW, cellY)
        }
        if (!isLastRowOfChunk) {
          doc.line(cellX, cellY + cellH, cellX + cellW, cellY + cellH)
        }
        if (cell.colStart > 0) {
          doc.line(cellX, cellY, cellX, cellY + cellH)
        }
        if (cell.colStart + cell.colspan < colCount) {
          doc.line(cellX + cellW, cellY, cellX + cellW, cellY + cellH)
        }
        break
      }
      default: {
        doc.rect(cellX, cellY, cellW, cellH, 'S')
        break
      }
    }
    if (dash) {
      doc.setLineDashPattern([], 0)
    }
  }

  // 分块绘制
  let r = 0
  while (r < rowCount) {
    const end = groupEndOf[r]
    let groupHeight = 0
    for (let i = r; i < end; i++) {
      groupHeight += rowHeights[i]
    }
    if (
      ctx.y + groupHeight > ctx.contentBottom + 0.5 &&
      ctx.y > ctx.contentTop + 0.5
    ) {
      await newPage(ctx)
    }
    const groupY = ctx.y
    // EXTERNAL：整块外框
    if (table.borderType === TableBorder.EXTERNAL) {
      doc.setDrawColor(borderColor)
      doc.setLineWidth(borderWidth)
      doc.rect(colXs[0], groupY, colXs[colCount] - colXs[0], groupHeight, 'S')
    }
    const dash = table.borderType === TableBorder.DASH
    for (const cell of cells) {
      if (cell.rowStart < r || cell.rowStart >= end) continue
      const cellX = colXs[cell.colStart]
      const cellW = colXs[cell.colStart + cell.colspan] - cellX
      const cellY =
        groupY + rowHeights.slice(r, cell.rowStart).reduce((s, h) => s + h, 0)
      const cellH = rowHeights
        .slice(cell.rowStart, cell.rowStart + cell.rowspan)
        .reduce((s, h) => s + h, 0)
      // 背景
      const background = normalizeColor(cell.backgroundColor)
      if (background) {
        doc.setFillColor(background)
        doc.rect(cellX, cellY, cellW, cellH, 'F')
      }
      drawTableBorders(
        cell,
        cellX,
        cellY,
        cellW,
        cellH,
        cell.rowStart === r,
        cell.rowStart + cell.rowspan === end,
        dash
      )
      // 文本
      let offsetY = 0
      if (cell.verticalAlign === VerticalAlign.MIDDLE) {
        offsetY = Math.max(0, (cellH - cell.contentHeight) / 2)
      } else if (cell.verticalAlign === VerticalAlign.BOTTOM) {
        offsetY = Math.max(0, cellH - cell.contentHeight)
      }
      let textY = cellY + offsetY
      for (const { paragraph, lines } of cell.paragraphs) {
        for (let i = 0; i < lines.length; i++) {
          await drawLayoutLine(doc, ctx, lines[i], {
            x: cellX,
            y: textY,
            rowFlex: paragraph.rowFlex,
            isLast: i === lines.length - 1,
            maxWidth: cellW
          })
          textY += lines[i].height
        }
      }
    }
    ctx.y = groupY + groupHeight
    r = end
  }
}

// ====================================================================
// 绘制：分隔线 / 浮动图片 / 分页
// =====================================================================

async function drawSeparator(
  doc: OfdDocument,
  ctx: ExportContext,
  block: DrawSeparator
) {
  const metrics = measureFontMetrics(ctx.defaultFont, ctx.defaultSize)
  const margin = rowMarginOf(ctx.defaultSize, undefined, ctx)
  const height = metrics.ascent + metrics.descent + margin * 2
  await ensureSpace(ctx, height)
  const y = ctx.y + height / 2
  doc.setDrawColor(normalizeColor(block.color) || '#000000')
  doc.setLineWidth(block.lineWidth || 1)
  if (block.dashArray?.length) {
    doc.setLineDashPattern(block.dashArray, 0)
  }
  doc.line(ctx.contentLeft, y, ctx.contentRight, y)
  if (block.dashArray?.length) {
    doc.setLineDashPattern([], 0)
  }
  ctx.y += height
}

function drawFloatImage(doc: OfdDocument, block: DrawFloatImage) {
  doc.addImage(block.value, {
    x: block.x,
    y: block.y,
    w: block.width,
    h: block.height
  })
}

// ====================================================================
// 页面设施：水印 / 页眉 / 页脚 / 页码
// =====================================================================

function drawWatermark(doc: OfdDocument, ctx: ExportContext) {
  const watermark = ctx.watermark
  if (!watermark || watermark.data == null) return
  if (watermark.type === 'image') {
    const w = watermark.width || 300
    const h = watermark.height || 300
    doc.addImage(String(watermark.data), {
      x: (ctx.pageWidth - w) / 2,
      y: (ctx.pageHeight - h) / 2,
      w,
      h
    })
    return
  }
  const text = String(watermark.data || '')
  if (!text) return
  const font = String(watermark.font || 'Microsoft YaHei')
  const size = watermark.size || 120
  const color = normalizeColor(watermark.color) || '#AEB5C0'
  const opacity = watermark.opacity !== undefined ? watermark.opacity : 0.3
  doc.setFont(resolveFontKey(ctx, font), 'normal')
  doc.setFontSize(size * PX_PER_PT)
  doc.setTextColor(color)
  doc.setOpacity(opacity)
  const textWidth = doc.getTextWidth(text)
  const metrics = measureFontMetrics(font, size)
  const textHeight = metrics.ascent + metrics.descent
  const drawCenter = (cx: number, cy: number) => {
    doc.text(text, cx, cy, {
      fontSize: size * PX_PER_PT,
      angle: -45,
      align: 'center',
      baseline: 'middle'
    })
  }
  if (watermark.repeat) {
    // 平铺：对角线 + 2×gap 为平铺单元（与编辑器一致）
    const gapX = watermark.gap?.[0] ?? 10
    const gapY = watermark.gap?.[1] ?? 10
    const diagonal = Math.sqrt(textWidth * textWidth + textHeight * textHeight)
    const cellW = diagonal + gapX * 2
    const cellH = diagonal + gapY * 2
    const cols = Math.max(1, Math.ceil(ctx.pageWidth / cellW))
    const rows = Math.max(1, Math.ceil(ctx.pageHeight / cellH))
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        drawCenter((col + 0.5) * cellW, (row + 0.5) * cellH)
      }
    }
  } else {
    drawCenter(ctx.pageWidth / 2, ctx.pageHeight / 2)
  }
  doc.setOpacity(1)
}

// 页眉：编辑器从 header.top（默认 30px）开始排版，超出顶边距裁剪
async function drawFurnitureHeader(doc: OfdDocument, ctx: ExportContext) {
  const headerOption = ctx.headerOption || {}
  if (headerOption.disabled || !ctx.headerBlocks.length) return
  // disabledPages 为 0-based 页号
  if ((headerOption.disabledPages || []).includes(ctx.pageNo - 1)) return
  let y = headerOption.top ?? 30
  for (const block of ctx.headerBlocks) {
    for (const line of block.lines) {
      if (y + line.height > ctx.contentTop - 2) return
      await drawLayoutLine(doc, ctx, line, {
        x: ctx.contentLeft,
        y,
        rowFlex: block.rowFlex,
        isLast: true,
        maxWidth: ctx.contentWidth
      })
      y += line.height
    }
  }
}

// 页脚：编辑器底对齐到 pageHeight - footer.bottom（默认 30px），不侵入正文
async function drawFurnitureFooter(doc: OfdDocument, ctx: ExportContext) {
  const footerOption = ctx.footerOption || {}
  if (footerOption.disabled || !ctx.footerBlocks.length) {
    await drawPageNumber(doc, ctx)
    return
  }
  if ((footerOption.disabledPages || []).includes(ctx.pageNo - 1)) {
    await drawPageNumber(doc, ctx)
    return
  }
  const totalHeight = ctx.footerBlocks.reduce(
    (sum, block) => sum + block.lines.reduce((s, line) => s + line.height, 0),
    0
  )
  let y = ctx.pageHeight - (footerOption.bottom ?? 30) - totalHeight
  y = Math.max(y, ctx.contentBottom + 2)
  for (const block of ctx.footerBlocks) {
    for (const line of block.lines) {
      if (y + line.height > ctx.pageHeight) break
      await drawLayoutLine(doc, ctx, line, {
        x: ctx.contentLeft,
        y,
        rowFlex: block.rowFlex,
        isLast: true,
        maxWidth: ctx.contentWidth
      })
      y += line.height
    }
  }
  await drawPageNumber(doc, ctx)
}

// 页码：编辑器渲染在基线 pageHeight - pageNumber.bottom（默认 60px），
// fromPageNo（0-based）之前的页不显示，显示值 = 页号 + startPageNo - fromPageNo
async function drawPageNumber(doc: OfdDocument, ctx: ExportContext) {
  const pageNumber = ctx.pageNumber
  if (!pageNumber || pageNumber.disabled) return
  const fromPageNo = pageNumber.fromPageNo || 0
  // ctx.pageNo 为 1-based
  if (ctx.pageNo - 1 < fromPageNo) return
  const format = String(pageNumber.format || '{pageNo}')
  let displayNo: number | string =
    ctx.pageNo - 1 + (pageNumber.startPageNo || 1) - fromPageNo
  if (pageNumber.numberType === NumberType.CHINESE) {
    displayNo = numberToChinese(displayNo as number)
  }
  const text = format
    .split(/(\{pageNo\}|\{pageCount\})/)
    .filter(part => !!part)
    .map(part =>
      part === '{pageNo}'
        ? String(displayNo)
        : part === '{pageCount}'
          ? TOTAL_PAGES_PLACEHOLDER
          : part
    )
    .join('')
  if (!text) return
  const run: TextDrawRun = {
    type: 'text',
    text,
    family: pageNumber.font,
    size: pageNumber.size || 12,
    color: normalizeColor(pageNumber.color)
  }
  const lines = layoutParagraphToLines(
    doc,
    ctx,
    { type: 'paragraph', runs: [run] },
    ctx.contentWidth
  )
  const line = lines[0]
  await drawLayoutLine(doc, ctx, line, {
    x: ctx.contentLeft,
    y: ctx.pageHeight - (pageNumber.bottom ?? 60) - line.ascent,
    rowFlex: pageNumber.rowFlex,
    isLast: true,
    maxWidth: ctx.contentWidth
  })
}

async function drawFurniture(doc: OfdDocument, ctx: ExportContext) {
  drawWatermark(doc, ctx)
  await drawFurnitureHeader(doc, ctx)
  await drawFurnitureFooter(doc, ctx)
}

async function newPage(ctx: ExportContext) {
  ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight], 'p')
  ctx.pageNo++
  await drawFurniture(ctx.doc, ctx)
  ctx.y = ctx.contentTop
}

async function ensureSpace(ctx: ExportContext, height: number) {
  if (ctx.y + height <= ctx.contentBottom + 0.5) return
  if (ctx.y <= ctx.contentTop + 0.5) return // 单行超过整页高度：不再分页
  await newPage(ctx)
}

// ====================================================================
// 书签（标题大纲）
// =====================================================================

function buildOutline(doc: OfdDocument, ctx: ExportContext) {
  if (!ctx.outlines.length) return
  const stack: { level: number; node: OutlineNode }[] = []
  for (const item of ctx.outlines) {
    const level = titleOrder(item.level)
    let parent: OutlineNode | null = null
    for (const entry of stack) {
      if (entry.level < level) parent = entry.node
    }
    const node = doc.outline.add(parent, item.text, {
      pageNumber: item.pageNo
    })
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop()
    }
    stack.push({ level, node })
  }
}

function titleOrder(level: TitleLevel): number {
  switch (level) {
    case TitleLevel.FIRST:
      return 1
    case TitleLevel.SECOND:
      return 2
    case TitleLevel.THIRD:
      return 3
    case TitleLevel.FOURTH:
      return 4
    case TitleLevel.FIFTH:
      return 5
    default:
      return 6
  }
}

// ====================================================================
// 块绘制入口
// =====================================================================

async function drawBlock(
  doc: OfdDocument,
  ctx: ExportContext,
  block: DrawBlock
) {
  switch (block.type) {
    case 'paragraph':
      await drawParagraph(doc, ctx, block)
      break
    case 'table':
      await drawTableBlock(doc, ctx, block)
      break
    case 'separator':
      await drawSeparator(doc, ctx, block)
      break
    case 'pageBreak':
      await newPage(ctx)
      break
    case 'floatImage':
      drawFloatImage(doc, block)
      break
  }
}

// ====================================================================
// 导出入口
// =====================================================================

export interface IExportOfdOption {
  fileName: string
  // 自定义嵌入字体，family 需与编辑器中使用的字体名一致。
  // 与默认 Noto 嵌入并存，同名覆盖；映射表之外的字体必须通过此选项嵌入，
  // 否则以原字体名引用阅读器本机字体（缺失时被替换）。
  // 字节（data）与地址（url）二选一：data 优先，适合打包/上传的字体；
  // url 由插件拉取并缓存，适合部署在静态服务/CDN 的字体（需 TrueType .ttf）
  embedFonts?: {
    family: string
    url?: string
    data?: ArrayBuffer | Uint8Array
  }[]
  // 默认嵌入字体的获取地址前缀（目录需包含 NotoSansSC-Regular.ttf、
  // NotoSerifSC-Regular.ttf）；默认依次尝试同源 /fonts、/ofd/fonts 与
  // unpkg CDN；传 null 关闭默认嵌入（退回本机字体名引用，可能出现乱码）
  fontBaseUrl?: string | null
}

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeExportOfd(options: IExportOfdOption): Promise<Blob>
  }
}

// 预扫描文档字体：映射表与自定义注册之外的字体以原字体名注册非嵌入声明，
// 返回未识别字体列表（用于提示）。覆盖正文/页眉/页脚/控件/表格/水印/页码
function registerDocumentUnknownFonts(
  doc: OfdDocument,
  ctx: ExportContext,
  zones: { header?: IElement[]; main?: IElement[]; footer?: IElement[] }
): string[] {
  const families = new Set<string>([ctx.defaultFont])
  const walk = (elementList?: IElement[]) => {
    if (!elementList) return
    for (const element of elementList) {
      if (element.font) families.add(element.font)
      if (element.valueList) walk(element.valueList)
      const control: any = element.control
      if (control?.value) walk(control.value)
      if (element.trList) {
        for (const tr of element.trList) {
          for (const td of tr.tdList) {
            walk(td.value)
          }
        }
      }
    }
  }
  walk(zones.header)
  walk(zones.main)
  walk(zones.footer)
  if (ctx.watermark?.font) families.add(String(ctx.watermark.font))
  if (ctx.pageNumber?.font) families.add(String(ctx.pageNumber.font))
  const unknown: string[] = []
  for (const family of families) {
    if (!family || !family.trim()) continue
    const key = normalizeFontKey(family)
    if (ctx.customFontFamilies.has(key)) continue
    if (mapFontFamily(family, ctx.defaultFont)) continue
    // 未知字体：注册非嵌入声明（CJK 判定决定度量近似方式）
    doc.addFont(key, family, 'normal', { cjk: isCJKFontFamily(family) })
    ctx.customFontFamilies.add(key)
    unknown.push(family)
  }
  return unknown
}

function buildFurnitureBlocks(
  doc: OfdDocument,
  ctx: ExportContext,
  elementList: IElement[]
): FurnitureBlock[] {
  const blocks: FurnitureBlock[] = []
  for (const block of parseElementListToBlocks(elementList, ctx)) {
    if (block.type !== 'paragraph') continue
    blocks.push({
      lines: layoutParagraphToLines(doc, ctx, block, ctx.contentWidth),
      rowFlex: block.rowFlex
    })
  }
  return blocks
}

export default function (editor: Editor) {
  return async function (options: IExportOfdOption): Promise<Blob> {
    const { fileName, embedFonts, fontBaseUrl } = options
    const {
      data: { header, main, footer },
      options: editorOptions
    } = editor.command.getValue()

    const defaultFont = editorOptions.defaultFont || 'Microsoft YaHei'
    // 页面尺寸与页边距跟随编辑器配置
    const isHorizontal =
      editorOptions.paperDirection === PaperDirection.HORIZONTAL
    const rawWidth = editorOptions.width || DEFAULT_PAGE_WIDTH
    const rawHeight = editorOptions.height || DEFAULT_PAGE_HEIGHT
    const pageWidth = isHorizontal ? rawHeight : rawWidth
    const pageHeight = isHorizontal ? rawWidth : rawHeight
    const margins = editorOptions.margins || DEFAULT_PAGE_MARGIN

    const doc = new jsOFD({
      unit: 'px',
      format: [pageWidth, pageHeight],
      orientation: 'p'
    }) as OfdDocument
    doc.setProperties({
      title: fileName,
      creator: '@hufe921/canvas-editor-plugin-ofd'
    })
    // 字体注册（必须在任何布局度量前完成，度量使用注册字体的真实步进）：
    // 1. 默认嵌入 Noto 字体（覆盖内置中文字体键）
    await registerDefaultEmbedFonts(doc, fontBaseUrl)
    // 2. 自定义嵌入字体：以规范化字体名独立注册（与默认并存，同名键覆盖）；
    //    data 优先，否则按 url 拉取（失败告警并退回非嵌入引用）
    const customFontFamilies = new Set<string>()
    if (embedFonts?.length) {
      for (const font of embedFonts) {
        let bytes: Uint8Array | null =
          font.data instanceof Uint8Array
            ? font.data
            : font.data
              ? new Uint8Array(font.data)
              : null
        if (!bytes && font.url) {
          bytes = await fetchFontUrl(font.url)
        }
        if (!bytes) {
          console.warn(
            '[canvas-editor-plugin-ofd] 自定义字体获取失败，' +
              `以本机字体引用导出：${font.family}`
          )
          continue
        }
        const key = normalizeFontKey(font.family)
        doc.addFontTtf(key, font.family, bytes)
        customFontFamilies.add(key)
      }
    }
    // 页码总数占位符：输出前手动替换（编辑器总页数 = 页数 - fromPageNo）
    const ctx: ExportContext = {
      doc,
      pageWidth,
      pageHeight,
      contentLeft: margins[3],
      contentTop: margins[0],
      contentRight: pageWidth - margins[1],
      contentBottom: pageHeight - margins[2],
      contentWidth: pageWidth - margins[1] - margins[3],
      y: 0,
      pageNo: 1,
      defaultFont,
      defaultSize: editorOptions.defaultSize || 16,
      defaultRowMargin: editorOptions.defaultRowMargin || 1,
      basicRowMarginHeight: editorOptions.defaultBasicRowMarginHeight || 8,
      watermark: (editorOptions as Record<string, any>).watermark,
      pageNumber: editorOptions.pageNumber as any,
      headerOption: (editorOptions as Record<string, any>).header,
      footerOption: (editorOptions as Record<string, any>).footer,
      customFontFamilies,
      headerBlocks: [],
      footerBlocks: [],
      outlines: []
    }
    // 3. 文档中映射表之外的字体：以原字体名注册非嵌入声明，
    //    阅读器端按本机字体解析（有则正常显示，无则替换）；仅提示不中断
    const unknownFonts = registerDocumentUnknownFonts(doc, ctx, {
      header,
      main,
      footer
    })
    if (unknownFonts.length) {
      console.warn(
        '[canvas-editor-plugin-ofd] 以下字体未嵌入，导出依赖阅读器本机字体，' +
          `缺失时将被替换：${unknownFonts.join('、')}；` +
          '可通过 embedFonts 选项提供字体字节（TTF）以嵌入'
      )
    }
    ctx.y = ctx.contentTop
    ctx.headerBlocks = buildFurnitureBlocks(doc, ctx, header || [])
    ctx.footerBlocks = buildFurnitureBlocks(doc, ctx, footer || [])

    // 第一页页面设施（水印/页眉/页脚/页码）
    await drawFurniture(doc, ctx)

    const blocks = parseElementListToBlocks(main || [], ctx)
    for (const block of blocks) {
      await drawBlock(doc, ctx, block)
    }

    buildOutline(doc, ctx)

    // 页码总数替换：编辑器语义为 页数 - fromPageNo（中文页码时同样转换）
    const fromPageNo = ctx.pageNumber?.fromPageNo || 0
    const rawTotal = doc.pages.length - fromPageNo
    const totalDisplay =
      ctx.pageNumber?.numberType === NumberType.CHINESE
        ? numberToChinese(rawTotal)
        : String(rawTotal)
    for (const page of doc.pages) {
      for (const object of page.objects) {
        if (
          object.t === 'text' &&
          object.text.includes(TOTAL_PAGES_PLACEHOLDER)
        ) {
          object.text = object.text
            .split(TOTAL_PAGES_PLACEHOLDER)
            .join(totalDisplay)
        }
      }
    }

    // 页面配置写入附件：导入时精确还原（margins/页眉/页脚/页码/水印等）
    const watermark = ctx.watermark
    const pageNumberOption = ctx.pageNumber
    const headerOption = ctx.headerOption || {}
    const footerOption = ctx.footerOption || {}
    doc.addFileAsAttachment(
      PAGE_INFO_ATTACHMENT,
      JSON.stringify({
        version: 1,
        width: rawWidth,
        height: rawHeight,
        margins,
        paperDirection: editorOptions.paperDirection,
        defaultFont,
        defaultSize: ctx.defaultSize,
        defaultRowMargin: ctx.defaultRowMargin,
        defaultBasicRowMarginHeight: ctx.basicRowMarginHeight,
        header: {
          top: headerOption.top,
          disabled: headerOption.disabled,
          disabledPages: headerOption.disabledPages
        },
        footer: {
          bottom: footerOption.bottom,
          disabled: footerOption.disabled,
          disabledPages: footerOption.disabledPages
        },
        pageNumber: pageNumberOption,
        // 图片水印体积大不序列化，导入时按页面图片还原策略处理
        watermark:
          watermark && watermark.type !== 'image' && watermark.data
            ? watermark
            : undefined
      }),
      {
        format: 'json',
        description: 'canvas-editor page setup for round-trip import'
      }
    )

    // jsofd 输出为 STORE（未压缩）ZIP；重新以 DEFLATE 打包减小体积
    // （字体/图片可压缩约 40%），条目顺序保持 OFD.xml 在首位
    const raw = doc.output('arraybuffer') as ArrayBuffer
    const blob = await repackDeflate(raw)
    saveAs(blob, `${fileName}.ofd`)
    return blob
  }
}

async function repackDeflate(arrayBuffer: ArrayBuffer): Promise<Blob> {
  try {
    const source = await JSZip.loadAsync(arrayBuffer)
    const target = new JSZip()
    for (const name of Object.keys(source.files)) {
      const file = source.files[name]
      if (file.dir) continue
      target.file(name, await file.async('uint8array'), {
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })
    }
    const packed = await target.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    // JSZip blob 输出固定 application/zip，需显式指定 OFD MIME
    return new Blob([packed], { type: 'application/ofd' })
  } catch {
    // 重打包失败时退回原始输出
    return new Blob([arrayBuffer], { type: 'application/ofd' })
  }
}
