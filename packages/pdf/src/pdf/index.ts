/**
 * canvas-editor-pdf 函数式导出模块
 *
 * 本模块将 DrawPdf 类重构为函数式实现，通过闭包维护状态，提供 PDF 生成能力。
 * 不依赖原 DrawPdf 类，完全独立实现，支持同步渲染和异步字体加载。
 *
 * @module export-pdf-fun
 */

import { jsPDF, type Context2d } from 'jspdf'
import type {
  IEditorOption,
  IEditorData,
  IElement,
  IRow,
  IRowElement,
  IElementMetrics,
  IMargin,
  DeepRequired,
  PdfOptions,
  IComputeRowListPayload,
  IDrawRowPayload,
  IDrawPagePayload,
  IDrawPdfLike
} from './types'
import {
  EditorZone,
  ElementType,
  RowFlex,
  ImageDisplay,
  ControlComponent,
  ZERO
} from './types'
import {
  PUNCTUATION_REG,
  getUUID,
  deepClone,
  pickSurroundElementList,
  getIsBlockElement,
  deleteSurroundElementList,
  spliceElementList,
  filterAssistElement
} from './utils'
import { mergeOption, formatElementList } from './options'
import { platform } from './platform/browser'
import { Position } from './position/index'
import { Highlight, Underline, Strikeout } from './particles/decorators'
import {
  TextParticle,
  ImageParticle,
  LaTexParticle,
  HyperlinkParticle,
  SeparatorParticle,
  SuperscriptParticle,
  SubscriptParticle,
  CheckboxParticle,
  RadioParticle,
  TableParticle,
  ListParticle,
  BlockParticle,
  LabelParticle
} from './particles'
import {
  Background,
  PageNumber,
  LineNumber,
  Watermark,
  Placeholder,
  PageBorder,
  Group,
  Area,
  ImageObserver,
  ColumnManager
} from './frames'
import { Header, Footer } from './frames/header-footer'

/**
 * 字体缓存条目接口
 *
 * @internal
 */
interface IFontCacheEntry {
  /** 字体文件名 */
  fileName: string
  /** 字体文件的 Base64 编码内容 */
  base64: string
  /** 字体 ID（用于 jsPDF 的 addFont） */
  id: string
  /** 字体类型：normal | bold | italic | bolditalic */
  type: string
}

/**
 * 默认字体列表
 *
 * 包含微软雅黑和 Arial 两种字体的常规、粗体、斜体、粗斜体变体。
 *
 * @internal
 */
const DEFAULT_FONTS: ReadonlyArray<{
  /** 字体文件名 */
  fileName: string
  /** 字体 ID（用于 jsPDF 的 addFont） */
  id: string
  /** 字体类型 */
  type: 'normal' | 'bold' | 'italic' | 'bolditalic'
}> = [
  { fileName: 'msyh.ttf', id: 'microsoft yahei', type: 'normal' },
  { fileName: 'msyh-bold.ttf', id: 'microsoft yahei', type: 'bold' },
  { fileName: 'Arial.ttf', id: 'arial', type: 'normal' },
  { fileName: 'Arial_Bold.ttf', id: 'arial', type: 'bold' },
  { fileName: 'Arial_Italic.ttf', id: 'arial', type: 'italic' },
  { fileName: 'Arial_Bold_Italic.ttf', id: 'arial', type: 'bolditalic' }
]

/**
 * CDN 字体基础路径
 *
 * @internal
 */
const CDN_FONT_BASE =
  'https://cdn.jsdelivr.net/npm/canvas-editor-pdf@0.2.7/dist/font'

/**
 * DrawPdf 函数式实例类型
 *
 * 包含所有对外暴露的方法，通过闭包维护内部状态。
 */
export type DrawPdfInstance = {
  /**
   * 渲染 PDF 内容
   *
   * 执行完整的渲染流程：重置 PDF、计算布局、绘制页面。
   */
  render(): void

  /**
   * 获取 jsPDF 实例
   *
   * @returns jsPDF 实例
   */
  getPdf(): jsPDF

  /**
   * 获取 PDF 的 Blob 对象
   *
   * @returns PDF Blob
   */
  getBlob(): Blob

  /**
   * 获取 PDF 的 Base64 编码字符串
   *
   * @returns Base64 编码的 PDF 字符串
   */
  getBase64(): string

  /**
   * 下载并加载字体
   *
   * @param source 字体文件来源 URL
   * @param fileName 字体文件名
   * @param id 字体 ID
   * @param type 字体类型：normal | bold | italic | bolditalic
   * @returns 字体的 Base64 编码内容
   */
  downloadFont(
    source: string,
    fileName: string,
    id: string,
    type: string
  ): Promise<string>

  /**
   * 默认字体加载完成的 Promise
   *
   * 当 pdfOptions.loadDefaultFonts 为 true 时，此 Promise 在所有默认字体加载完成后 resolve。
   */
  readonly defaultFontsLoadedPromise: Promise<boolean>

  /**
   * 获取页面宽度（已应用缩放）
   *
   * @returns 页面宽度（像素）
   */
  getWidth(): number

  /**
   * 获取页面高度（已应用缩放）
   *
   * @returns 页面高度（像素）
   */
  getHeight(): number

  /**
   * 获取编辑器选项
   *
   * @returns 合并后的编辑器选项
   */
  getOptions(): DeepRequired<IEditorOption>

  /**
   * 获取页面内部宽度（减去左右边距）
   *
   * @returns 内部宽度（像素）
   */
  getInnerWidth(): number

  /**
   * 获取主内容区域高度
   *
   * @returns 主内容区域高度（像素）
   */
  getMainHeight(): number

  /**
   * 获取主内容区域外部高度（包含边距、页眉、页脚）
   *
   * @param pageNo 页码（可选）
   * @returns 外部高度（像素）
   */
  getMainOuterHeight(pageNo?: number): number

  /**
   * 获取页面边距（已应用缩放）
   *
   * @returns 边距数组 [top, right, bottom, left]
   */
  getMargins(): IMargin

  /**
   * 获取元素的字体大小
   *
   * @param el 元素对象
   * @returns 字体大小
   */
  getElementSize(el: IElement): number

  /**
   * 获取高亮区域的边距高度
   *
   * @returns 高亮边距高度（像素）
   */
  getHighlightMarginHeight(): number

  /**
   * 获取 Canvas 2D 上下文
   *
   * @returns Context2d 对象
   */
  getCtx2d(): Context2d

  /**
   * 获取页面数量
   *
   * @returns 页面数量
   */
  getPageCount(): number

  /**
   * 获取每页的行列表
   *
   * @returns 二维数组，每行包含该行的元素列表
   */
  getPageRowList(): IRow[][]

  /**
   * 测量文本宽度
   *
   * @param font 字体样式字符串
   * @param text 要测量的文本
   * @returns TextMetrics 对象
   */
  measureText(font: string, text: string): TextMetrics

  /**
   * 获取元素的字体样式字符串
   *
   * @param el 元素对象
   * @param scale 缩放比例（默认 1）
   * @returns CSS 字体样式字符串
   */
  getFont(el: IElement, scale?: number): string

  /**
   * 获取页眉组件实例
   *
   * @returns Header 实例
   */
  getHeader(): Header

  /**
   * 获取页脚组件实例
   *
   * @returns Footer 实例
   */
  getFooter(): Footer

  /**
   * 绘制一行内容
   *
   * @param ctx2d Canvas 2D 上下文
   * @param payload 绘制参数
   */
  drawRow(ctx2d: Context2d, payload: IDrawRowPayload): void

  /**
   * 计算行列表
   *
   * 将元素列表转换为行列表，处理换行、分页等布局逻辑。
   *
   * @param payload 计算参数
   * @returns 行列表
   */
  computeRowList(payload: IComputeRowListPayload): IRow[]

  /**
   * 重新加载默认字体
   *
   * @returns 默认字体加载完成的 Promise
   */
  loadDefaultFonts(): Promise<boolean>

  /**
   * 添加自定义字体
   *
   * @param url 字体文件 URL
   * @param fileName 字体文件名
   * @param id 字体 ID
   * @param type 字体类型：normal | bold | italic | bolditalic
   * @returns 是否加载成功
   */
  addFont(
    url: string,
    fileName: string,
    id: string,
    type: string
  ): Promise<boolean>

  /**
   * 设置编辑器数据
   *
   * @param payload 数据对象（部分字段）
   */
  setValue(payload: Partial<IEditorData>): Promise<void>

  /**
   * 下载 PDF 文件
   *
   * @param filename 文件名（默认 'export.pdf'）
   */
  download(filename?: string): Promise<void>

  /**
   * 获取 PDF 的 Blob 对象（异步）
   *
   * @returns PDF Blob
   */
  toBlob(): Promise<Blob>

  /**
   * 获取 PDF 的 Data URL
   *
   * @returns Data URL 字符串
   */
  toDataUrl(): Promise<string>
}

/**
 * 创建 DrawPdf 函数式实例
 *
 * 通过闭包维护内部状态，不依赖原 DrawPdf 类，完全独立实现。
 * 初始化顺序：
 * 1. 合并选项并克隆数据
 * 2. 初始化 jsPDF 实例
 * 3. 创建所有组件实例
 * 4. 加载默认字体（可选）
 *
 * @param options 编辑器选项
 * @param data 编辑器数据（包含 header、main、footer）
 * @param pdfOptions PDF 生成选项
 * @returns DrawPdfInstance 对象
 */
export function createDrawPdf(
  options: IEditorOption | object = {},
  data: IEditorData,
  pdfOptions: PdfOptions = {}
): DrawPdfInstance {
  const mergedOptions = mergeOption(options as IEditorOption)
  const clonedData = deepClone(data) as IEditorData

  let headerElementList: IElement[] = []
  let mainElementList: IElement[] = []
  let footerElementList: IElement[] = []
  if (Array.isArray(clonedData)) {
    mainElementList = clonedData as unknown as IElement[]
  } else {
    headerElementList = clonedData.header || []
    mainElementList = clonedData.main
    footerElementList = clonedData.footer || []
  }

  const pageComponentData = [
    headerElementList,
    mainElementList,
    footerElementList
  ]
  for (const list of pageComponentData) {
    if (list && list.length) {
      formatElementList(list, {
        editorOptions: mergedOptions,
        isForceCompensation: true
      })
    }
  }

  const elementList = mainElementList

  let pdf: jsPDF
  const fontCache: IFontCacheEntry[] = []
  const fontSource = pdfOptions.fontSource ?? platform.defaultFontSource
  let pageRowList: IRow[][] = []
  let rowList: IRow[] = []
  const loadedFonts = new Set<string>()

  const imageObserver = new ImageObserver()

  // eslint-disable-next-line prefer-const
  let LETTER_REG: RegExp
  // eslint-disable-next-line prefer-const
  let WORD_LIKE_REG: RegExp
  const controlMinWidthPlaceholderElementListSet = new WeakSet<IElement[]>()

  let defaultFontsLoadedPromise: Promise<boolean> = Promise.resolve(false)

  function _resetPdf(): void {
    pdf = new jsPDF({
      orientation: 'p',
      unit: 'px',
      format: [getWidth(), getHeight()],
      hotfixes: ['px_scaling'],
      compress: true
    })
    pdf.setDocumentProperties({
      author: 'canvas-editor'
    })
    fontCache.forEach(f => _applyFont(pdf, f))
  }

  function _clearPage(_pageNo: number): void {
    void _pageNo
  }

  function _syncPageCount(): void {
    const target = pageRowList.length
    const current = pdf.getNumberOfPages()
    if (current < target) {
      for (let i = current; i < target; i++) {
        pdf.addPage([getWidth(), getHeight()], 'portrait')
      }
    } else if (current > target) {
      for (let i = current; i > target; i--) {
        pdf.deletePage(i)
      }
    }
  }

  function _applyFont(pdfInstance: jsPDF, font: IFontCacheEntry): void {
    pdfInstance.addFileToVFS(font.fileName, font.base64)
    pdfInstance.addFont(font.fileName, font.id, font.type)
  }

  function _resolveDefaultFontSource(fileName: string): string {
    if (fontSource === 'cdn') {
      return `${CDN_FONT_BASE}/${fileName}`
    }
    if (fontSource === 'bundled') {
      return platform.getBundledFontPath(fileName)
    }
    return `${(fontSource as { dir: string }).dir.replace(/\/+$/, '')}/${fileName}`
  }

  async function _addDefaultFont(): Promise<boolean> {
    await Promise.all(
      DEFAULT_FONTS.map(font =>
        downloadFont(
          _resolveDefaultFontSource(font.fileName),
          font.fileName,
          font.id,
          font.type
        ).catch(e => {
          console.warn(`Failed to load font ${font.fileName}:`, e)
        })
      )
    )
    return true
  }

  async function downloadFont(
    source: string,
    fileName: string,
    id: string,
    type: string
  ): Promise<string> {
    const base64 = await platform.loadFontAsBase64(source)
    const font: IFontCacheEntry = { fileName, base64, id, type }
    fontCache.push(font)
    _applyFont(pdf, font)
    platform.registerFontForMeasurement(font, base64)
    loadedFonts.add(fileName)
    return base64
  }

  function loadDefaultFonts(): Promise<boolean> {
    loadedFonts.clear()
    fontCache.length = 0
    return (defaultFontsLoadedPromise = _addDefaultFont())
  }

  async function addFont(
    url: string,
    fileName: string,
    id: string,
    type: string
  ): Promise<boolean> {
    await downloadFont(url, fileName, id, type)
    return true
  }

  function getOptions(): DeepRequired<IEditorOption> {
    return mergedOptions
  }

  function getOriginalWidth(): number {
    const { paperDirection, width, height } = mergedOptions
    return paperDirection === 'vertical' ? width : height
  }

  function getOriginalHeight(): number {
    const { paperDirection, width, height } = mergedOptions
    return paperDirection === 'vertical' ? height : width
  }

  function getWidth(): number {
    return Math.floor(getOriginalWidth() * mergedOptions.scale)
  }

  function getHeight(): number {
    return Math.floor(getOriginalHeight() * mergedOptions.scale)
  }

  function getInnerWidth(): number {
    const width = getWidth()
    const margins = getMargins()
    return width - margins[1] - margins[3]
  }

  function getMainHeight(): number {
    return getHeight() - getMainOuterHeight()
  }

  function getMainOuterHeight(pageNo?: number): number {
    const margins = getMargins()
    const headerExtraHeight = header.getExtraHeight(pageNo)
    const footerExtraHeight = footer.getExtraHeight(pageNo)
    return margins[0] + margins[2] + headerExtraHeight + footerExtraHeight
  }

  function getOriginalMargins(): number[] {
    const { margins, paperDirection } = mergedOptions
    return paperDirection === 'vertical'
      ? margins
      : [margins[1], margins[2], margins[3], margins[0]]
  }

  function getMargins(): IMargin {
    return getOriginalMargins().map(m => m * mergedOptions.scale) as IMargin
  }

  function getDefaultBasicRowMarginHeight(): number {
    return mergedOptions.defaultBasicRowMarginHeight * mergedOptions.scale
  }

  function getElementRowMargin(el: IElement): number {
    const {
      defaultSize,
      defaultBasicRowMarginHeight,
      defaultRowMargin,
      scale
    } = mergedOptions
    const fontSize = el.size || defaultSize
    let ratio = 1
    if (fontSize < 12) {
      ratio = fontSize / 12
    } else if (fontSize > 30) {
      ratio = 1 + (fontSize - 30) / 30
    }
    return (
      defaultBasicRowMarginHeight *
      ratio *
      (el.rowMargin ?? defaultRowMargin) *
      scale
    )
  }

  function getElementSize(el: IElement): number {
    return el.actualSize || el.size || mergedOptions.defaultSize
  }

  function getHighlightMarginHeight(): number {
    return mergedOptions.highlightMarginHeight * mergedOptions.scale
  }

  function getFont(el: IElement, scale = 1): string {
    const { defaultSize, defaultFont } = mergedOptions
    const font = el.font || defaultFont
    const size = (el.actualSize || el.size || defaultSize) * scale
    return `${el.italic ? 'italic ' : ''}${el.bold ? 'bold ' : ''}${size}px ${font}`
  }

  function measureText(font: string, text: string): TextMetrics {
    const canvas = platform.createMeasurementCanvas()
    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.font = font
    const m = ctx.measureText(text)
    ctx.restore()
    return m
  }

  function getCtx2d(): Context2d {
    return pdf.context2d
  }

  function getPdf(): jsPDF {
    return pdf
  }

  function getPageCount(): number {
    return pageRowList.length
  }

  function getPageRowList(): IRow[][] {
    return pageRowList
  }

  function getHeader(): Header {
    return header
  }

  function getFooter(): Footer {
    return footer
  }

  function computeRowList(payload: IComputeRowListPayload): IRow[] {
    const {
      innerWidth,
      elementList: elements,
      isPagingMode = false,
      isFromTable = false,
      startX = 0,
      startY = 0,
      pageHeight = 0,
      surroundElementList = []
    } = payload
    const {
      defaultSize,
      scale,
      imgCaption,
      table: { tdPadding },
      defaultTabWidth
    } = mergedOptions
    const defaultBasicRowMarginHeight = getDefaultBasicRowMarginHeight()

    if (controlMinWidthPlaceholderElementListSet.has(elements)) {
      for (let i = elements.length - 1; i >= 0; i--) {
        if (elements[i].isControlMinWidthPlaceholder) {
          elements.splice(i, 1)
        }
      }
      controlMinWidthPlaceholderElementListSet.delete(elements)
    }

    const listStyleMap = listParticle.computeListStyle(getCtx2d(), elements)
    const resultRowList: IRow[] = []
    const layout =
      isPagingMode && !isFromTable ? columnManager.getLayout() : null
    const isColumnEnabled = !!layout && layout.count > 1
    if (elements.length) {
      resultRowList.push({
        width: 0,
        height: 0,
        ascent: 0,
        elementList: [],
        startIndex: 0,
        rowIndex: 0,
        rowFlex: elements?.[0]?.rowFlex || elements?.[1]?.rowFlex,
        ...(isColumnEnabled ? { columnIndex: 0 } : {})
      })
    }

    let x = startX
    let y = startY
    let pageNo = 0
    let pageStartY = startY
    if (isPagingMode && !isFromTable) {
      pageStartY = getMargins()[0] + getHeader().getExtraHeight(0)
      y = pageStartY
    }

    const listIndexMap: Map<string, number> = new Map()
    let controlRealWidth = 0
    let currentColumn = 0

    for (let i = 0; i < elements.length; i++) {
      const curRow = resultRowList[resultRowList.length - 1]
      const element = elements[i]
      const rowMargin = getElementRowMargin(element)
      const metrics: IElementMetrics = {
        width: 0,
        height: 0,
        boundingBoxAscent: 0,
        boundingBoxDescent: 0
      }

      const offsetX =
        curRow.offsetX ||
        (element.listId &&
          (listStyleMap.get(element.listId) || 0) +
            (element.listLevel
              ? listParticle.LIST_INDENT_WIDTH * element.listLevel * scale
              : 0)) ||
        0
      const rowMaxWidth = isColumnEnabled && layout ? layout.width : innerWidth
      const availableWidth = rowMaxWidth - offsetX

      const isStartElement = curRow.elementList.length === 1
      x += isStartElement ? offsetX : 0
      y += isStartElement ? curRow.offsetY || 0 : 0

      if (element.hide || element.control?.hide || element.area?.hide) {
        const preElement = curRow.elementList[curRow.elementList.length - 1]
        metrics.height =
          preElement?.metrics.height || mergedOptions.defaultSize * scale
        metrics.boundingBoxAscent = preElement?.metrics.boundingBoxAscent || 0
        metrics.boundingBoxDescent = preElement?.metrics.boundingBoxDescent || 0
      } else if (
        element.type === ElementType.IMAGE ||
        element.type === ElementType.LATEX
      ) {
        if (
          element.imgDisplay === ImageDisplay.SURROUND ||
          element.imgDisplay === ImageDisplay.FLOAT_TOP ||
          element.imgDisplay === ImageDisplay.FLOAT_BOTTOM
        ) {
          metrics.width = 0
          metrics.height = 0
          metrics.boundingBoxDescent = 0
        } else {
          const elementWidth = element.width! * scale
          const elementHeight = element.height! * scale
          if (elementWidth > availableWidth) {
            const adaptiveHeight =
              (elementHeight * availableWidth) / elementWidth
            element.width = availableWidth / scale
            element.height = adaptiveHeight / scale
            metrics.width = availableWidth
            metrics.height = adaptiveHeight
            metrics.boundingBoxDescent = adaptiveHeight
          } else {
            metrics.width = elementWidth
            metrics.height = elementHeight
            metrics.boundingBoxDescent = elementHeight
          }
          if (element.imgCaption?.value) {
            const fontSize = element.imgCaption.size || imgCaption.size
            const captionTop = element.imgCaption.top ?? imgCaption.top
            const captionHeight = (fontSize + captionTop) * scale
            metrics.boundingBoxAscent += captionHeight
          }
        }
      } else if (element.type === ElementType.TABLE) {
        const tdPaddingWidth = tdPadding[1] + tdPadding[3]
        const tdPaddingHeight = tdPadding[0] + tdPadding[2]

        if (element.pagingId) {
          let tableIndex = i + 1
          let combineCount = 0
          while (tableIndex < elements.length) {
            const nextElement = elements[tableIndex]
            if (nextElement.pagingId === element.pagingId) {
              const nexTrList = nextElement.trList!.filter(
                tr => !tr.pagingRepeat
              )
              element.trList!.push(...nexTrList)
              element.height! += nextElement.height!
              tableIndex++
              combineCount++
            } else {
              break
            }
          }
          if (combineCount) {
            elements.splice(i + 1, combineCount)
          }
        }

        element.pagingIndex = element.pagingIndex ?? 0
        const trList = element.trList!
        const tdMinHeight =
          tdPaddingHeight + defaultSize + (rowMargin * 2) / scale
        for (let t = 0; t < trList.length; t++) {
          const tr = trList[t]
          tr.height = Math.max(tdMinHeight, tr.minHeight || 0)
          tr.minHeight = tr.height
        }

        tableParticle.computeRowColInfo(element)

        for (let t = 0; t < trList.length; t++) {
          const tr = trList[t]
          for (let d = 0; d < (tr.tdList || []).length; d++) {
            const td = (tr.tdList || [])[d]
            const tdRowList = computeRowList({
              innerWidth: (td.width! - tdPaddingWidth) * scale,
              elementList: td.value,
              isFromTable: true,
              isPagingMode
            })
            const tdRowHeight = tdRowList.reduce(
              (pre, cur) => pre + (cur.height || 0),
              0
            )
            td.rowList = tdRowList
            const curTdHeight = tdRowHeight / scale + tdPaddingHeight
            if (td.height! < curTdHeight) {
              const extraHeight = curTdHeight - td.height!
              const changeTr = trList[t + td.rowspan - 1]
              changeTr.height = (changeTr.height || 0) + extraHeight
              ;(changeTr.tdList || []).forEach(changeTd => {
                changeTd.height! += extraHeight
                if (!changeTd.realHeight) {
                  changeTd.realHeight = changeTd.height!
                } else {
                  changeTd.realHeight! += extraHeight
                }
              })
            }
            let curTdMinHeight = 0
            let curTdRealHeight = 0
            let ti = 0
            while (ti < td.rowspan) {
              const curTr = trList[ti + t] || trList[t]
              curTdMinHeight += curTr.minHeight!
              curTdRealHeight += curTr.height!
              ti++
            }
            td.realMinHeight = curTdMinHeight
            td.realHeight = curTdRealHeight
            td.mainHeight = curTdHeight
          }
        }

        const reduceTrList = tableParticle.getTrListGroupByCol(trList)
        for (let t = 0; t < reduceTrList.length; t++) {
          const tr = reduceTrList[t]
          let reduceHeight = -1
          for (let d = 0; d < (tr.tdList || []).length; d++) {
            const td = (tr.tdList || [])[d]
            const curTdRealHeight = td.realHeight!
            const curTdHeight = td.mainHeight!
            const curTdMinHeight = td.realMinHeight!
            const curReduceHeight =
              curTdHeight < curTdMinHeight
                ? curTdRealHeight - curTdMinHeight
                : curTdRealHeight - curTdHeight
            if (!~reduceHeight || curReduceHeight < reduceHeight) {
              reduceHeight = curReduceHeight
            }
          }
          if (reduceHeight > 0) {
            const changeTr = trList[t]
            changeTr.height = (changeTr.height || 0) - reduceHeight
            ;(changeTr.tdList || []).forEach(changeTd => {
              changeTd.height! -= reduceHeight
              changeTd.realHeight! -= reduceHeight
            })
          }
        }

        tableParticle.computeRowColInfo(element)

        const tableHeight = tableParticle.getTableHeight(element)
        const tableWidth = tableParticle.getTableWidth(element)
        element.width = tableWidth
        element.height = tableHeight
        const elementWidth = tableWidth * scale
        const elementHeight = tableHeight * scale
        metrics.width = elementWidth
        metrics.height = elementHeight
        metrics.boundingBoxDescent = elementHeight
        metrics.boundingBoxAscent = -rowMargin

        if (elements[i + 1]?.type === ElementType.TABLE) {
          metrics.boundingBoxAscent -= rowMargin
        }

        if (isPagingMode) {
          const height = getHeight()
          const marginHeight = getMainOuterHeight(pageNo)
          let curPagePreHeight = marginHeight
          for (let r = 0; r < resultRowList.length; r++) {
            const row = resultRowList[r]
            const rowOffsetY = row.offsetY || 0
            if (
              row.height + curPagePreHeight + rowOffsetY > height ||
              resultRowList[r - 1]?.isPageBreak
            ) {
              curPagePreHeight = marginHeight + row.height + rowOffsetY
            } else {
              curPagePreHeight += row.height + rowOffsetY
            }
          }

          const rowMarginHeight = rowMargin * 2 * scale
          const firstTrHeight = element.trList![0].height! * scale
          if (
            curPagePreHeight + firstTrHeight + rowMarginHeight > height ||
            (element.pagingIndex !== 0 && element.trList![0].pagingRepeat) ||
            elements[i - 1]?.type === ElementType.PAGE_BREAK
          ) {
            curPagePreHeight = marginHeight
          }

          if (curPagePreHeight + rowMarginHeight + elementHeight > height) {
            const trList = element.trList!
            let deleteStart = 0
            let deleteCount = 0
            let preTrHeight = 0

            if (trList.length > 1) {
              for (let r = 0; r < trList.length; r++) {
                const tr = trList[r]
                const trHeight = (tr.height || 0) * scale
                if (
                  curPagePreHeight + rowMarginHeight + preTrHeight + trHeight >
                  height
                ) {
                  const rowColCount = (tr.tdList || []).reduce(
                    (pre, cur) => pre + cur.colspan,
                    0
                  )
                  if (element.colgroup?.length !== rowColCount) {
                    deleteCount = 0
                  }
                  break
                } else {
                  deleteStart = r + 1
                  deleteCount = trList.length - deleteStart
                  preTrHeight += trHeight
                }
              }
            }

            if (deleteCount) {
              const cloneTrList = trList.splice(deleteStart, deleteCount)
              const cloneTrHeight = cloneTrList.reduce(
                (pre, cur) => pre + (cur.height || 0),
                0
              )
              const cloneTrRealHeight = cloneTrHeight * scale
              const pagingId = element.pagingId || getUUID()
              element.pagingId = pagingId
              element.height = (element.height || 0) - cloneTrHeight
              metrics.height -= cloneTrRealHeight
              metrics.boundingBoxDescent -= cloneTrRealHeight

              const cloneElement = deepClone(element)
              cloneElement.pagingId = pagingId
              cloneElement.pagingIndex = element.pagingIndex! + 1
              const repeatTrList = trList.filter(tr => tr.pagingRepeat)
              if (repeatTrList.length) {
                const cloneRepeatTrList = deepClone(repeatTrList)
                cloneRepeatTrList.forEach(tr => (tr.id = getUUID()))
                cloneTrList.unshift(...cloneRepeatTrList)
              }
              cloneElement.trList = cloneTrList
              cloneElement.id = getUUID()
              spliceElementList(elements, i + 1, 0, cloneElement)
            }
          }
        }
      } else if (element.type === ElementType.SEPARATOR) {
        const {
          separator: { lineWidth: defaultLineWidth }
        } = mergedOptions
        const lineWidth = element.lineWidth || defaultLineWidth
        element.width = availableWidth / scale
        metrics.width = availableWidth
        metrics.height = lineWidth * scale
        metrics.boundingBoxAscent = -rowMargin
        metrics.boundingBoxDescent = -rowMargin + metrics.height
      } else if (element.type === ElementType.PAGE_BREAK) {
        element.width = availableWidth / scale
        metrics.width = availableWidth
        metrics.height = defaultSize
      } else if (
        element.type === ElementType.RADIO ||
        element.controlComponent === ControlComponent.RADIO
      ) {
        const { width, height, gap } = mergedOptions.radio
        const elementWidth = width + gap * 2
        element.width = elementWidth
        metrics.width = elementWidth * scale
        metrics.height = height * scale
      } else if (
        element.type === ElementType.CHECKBOX ||
        element.controlComponent === ControlComponent.CHECKBOX
      ) {
        const { width, height, gap } = mergedOptions.checkbox
        const elementWidth = width + gap * 2
        element.width = elementWidth
        metrics.width = elementWidth * scale
        metrics.height = height * scale
      } else if (element.type === ElementType.TAB) {
        metrics.width = defaultTabWidth * scale
        metrics.height = defaultSize * scale
        metrics.boundingBoxDescent = 0
        metrics.boundingBoxAscent = textParticle.getBasisWordBoundingBoxAscent(
          getCtx2d(),
          getCtx2d().font
        )
      } else if (element.isControlMinWidthPlaceholder) {
        metrics.width = (element.width || 0) * scale
        metrics.height = defaultSize * scale
        getCtx2d().font = getFont(element)
        const basisMetrics = textParticle.measureBasisWord(
          getCtx2d(),
          element.font!
        )
        metrics.boundingBoxAscent = basisMetrics.actualBoundingBoxAscent * scale
        metrics.boundingBoxDescent =
          basisMetrics.actualBoundingBoxDescent * scale
      } else if (element.type === ElementType.BLOCK) {
        if (!element.width) {
          metrics.width = availableWidth
        } else {
          const elementWidth = element.width * scale
          metrics.width = Math.min(elementWidth, availableWidth)
        }
        metrics.height = element.height! * scale
        metrics.boundingBoxDescent = metrics.height
        metrics.boundingBoxAscent = 0
      } else if (element.type === ElementType.LABEL) {
        const {
          defaultSize: labelDefaultSize,
          label: { defaultPadding }
        } = mergedOptions
        getCtx2d().font = getFont(element)
        const fontMetrics = textParticle.measureText(getCtx2d(), element)
        metrics.width =
          (fontMetrics.width + defaultPadding[1] + defaultPadding[3]) * scale
        metrics.height = (element.size || labelDefaultSize) * scale
        metrics.boundingBoxDescent = 0
        metrics.boundingBoxAscent =
          (defaultPadding[0] + fontMetrics.actualBoundingBoxAscent) * scale
      } else {
        const size = element.size || defaultSize
        if (
          element.type === ElementType.SUPERSCRIPT ||
          element.type === ElementType.SUBSCRIPT
        ) {
          element.actualSize = Math.ceil(size * 0.6)
        }
        metrics.height = (element.actualSize || size) * scale
        getCtx2d().font = getFont(element)
        const fontMetrics = textParticle.measureText(getCtx2d(), element)
        metrics.width = fontMetrics.width * scale
        if (element.letterSpacing) {
          metrics.width += element.letterSpacing * scale
        }
        metrics.boundingBoxAscent =
          (element.value === ZERO
            ? textParticle.getBasisWordBoundingBoxAscent(
                getCtx2d(),
                element.font!
              )
            : fontMetrics.actualBoundingBoxAscent) * scale
        metrics.boundingBoxDescent =
          fontMetrics.actualBoundingBoxDescent * scale
        if (element.type === ElementType.SUPERSCRIPT) {
          metrics.boundingBoxAscent += metrics.height / 2
        } else if (element.type === ElementType.SUBSCRIPT) {
          metrics.boundingBoxDescent += metrics.height / 2
        }
      }

      const ascent =
        !element.hide &&
        ((element.imgDisplay !== ImageDisplay.INLINE &&
          element.type === ElementType.IMAGE) ||
          element.type === ElementType.LATEX)
          ? metrics.height + rowMargin
          : metrics.boundingBoxAscent + rowMargin
      const height =
        rowMargin +
        metrics.boundingBoxAscent +
        metrics.boundingBoxDescent +
        rowMargin
      const rowElement: IRowElement = Object.assign(element as IRowElement, {
        metrics,
        left: 0,
        style: getFont(element, scale)
      })

      if (
        rowElement.control?.minWidth &&
        !rowElement.isControlMinWidthPlaceholder
      ) {
        if (rowElement.controlComponent) {
          controlRealWidth += metrics.width
        }
        if (rowElement.controlComponent === ControlComponent.POSTFIX) {
          const controlMinWidth = rowElement.control!.minWidth * scale
          const extraWidth = controlMinWidth - controlRealWidth
          const rowRemainingWidth = Math.max(
            availableWidth - curRow.width - rowElement.metrics.width,
            0
          )
          if (extraWidth > 0) {
            const left = Math.min(rowRemainingWidth, extraWidth) * scale
            rowElement.left = left
            curRow.width += left
          }
          let placeholderWidth = extraWidth - rowRemainingWidth
          const placeholderList: IElement[] = []
          while (placeholderWidth > 0) {
            const width = Math.min(placeholderWidth, availableWidth)
            placeholderList.push({
              ...rowElement,
              value: '',
              width: width / scale,
              left: 0,
              isControlMinWidthPlaceholder: true
            } as unknown as IElement)
            placeholderWidth -= width
          }
          if (placeholderList.length) {
            elements.splice(i + 1, 0, ...placeholderList)
            controlMinWidthPlaceholderElementListSet.add(elements)
          }
          controlRealWidth = 0
        }
      }

      const preElement = elements[i - 1]
      let nextElement = elements[i + 1]
      let curRowWidth = curRow.width + metrics.width

      if (mergedOptions.wordBreak === 'break-word') {
        if (
          (!preElement?.type || preElement?.type === ElementType.TEXT) &&
          (!element.type || element.type === ElementType.TEXT)
        ) {
          const word = `${preElement?.value || ''}${element.value}`
          if (WORD_LIKE_REG.test(word)) {
            const { width: wordWidth, endElement } = textParticle.measureWord(
              getCtx2d(),
              elements,
              i
            )
            if (endElement && wordWidth * scale <= availableWidth) {
              curRowWidth += wordWidth * scale
              nextElement = endElement
            }
          }
          const punctuationWidth = textParticle.measurePunctuationWidth(
            getCtx2d(),
            nextElement
          )
          curRowWidth += punctuationWidth * scale
        }
      }

      if (element.listId && element.value === ZERO && !element.listWrap) {
        if (listIndexMap.has(element.listId)) {
          listIndexMap.set(
            element.listId,
            (listIndexMap.get(element.listId) ?? 0) + 1
          )
        } else {
          listIndexMap.set(element.listId, 0)
        }
      }

      const surroundPosition = position.setSurroundPosition({
        pageNo,
        rowElement,
        row: curRow,
        rowElementRect: {
          x,
          y,
          height,
          width: metrics.width
        },
        availableWidth,
        surroundElementList
      })
      x = surroundPosition.x
      curRowWidth += surroundPosition.rowIncreaseWidth
      x += metrics.width

      const isForceBreak =
        element.type === ElementType.SEPARATOR ||
        element.type === ElementType.TABLE ||
        preElement?.type === ElementType.TABLE ||
        preElement?.type === ElementType.BLOCK ||
        element.type === ElementType.BLOCK ||
        preElement?.imgDisplay === ImageDisplay.INLINE ||
        element.imgDisplay === ImageDisplay.INLINE ||
        preElement?.listId !== element.listId ||
        (preElement?.areaId !== element.areaId && !element.area?.hide) ||
        (i !== 0 && element.value === ZERO && !element.area?.hide)
      const isWidthNotEnough = curRowWidth > availableWidth
      const isWrap = isForceBreak || isWidthNotEnough

      if (isWrap) {
        const row: IRow = {
          width: metrics.width,
          height,
          startIndex: i,
          elementList: [rowElement],
          ascent,
          rowIndex: curRow.rowIndex + 1,
          rowFlex: elements[i]?.rowFlex || elements[i + 1]?.rowFlex,
          isPageBreak: element.type === ElementType.PAGE_BREAK,
          ...(isColumnEnabled ? { columnIndex: currentColumn } : {})
        }

        if (
          (rowElement as IElement).controlComponent !==
            ControlComponent.PREFIX &&
          (rowElement as IElement).control?.indentation === 'valueStart'
        ) {
          const preStartIndex = curRow.elementList.findIndex(
            el =>
              el.controlId === (rowElement as IElement).controlId &&
              el.controlComponent !== ControlComponent.PREFIX
          )
          if (~preStartIndex) {
            const preRowPositionList = position.computeRowPosition({
              row: curRow,
              innerWidth: getInnerWidth()
            })
            const valueStartPosition = preRowPositionList[preStartIndex]
            if (valueStartPosition) {
              row.offsetX = valueStartPosition.coordinate.leftTop[0]
            }
          }
        }

        if (element.listId) {
          row.isList = true
          row.offsetX =
            (listStyleMap.get(element.listId!) || 0) +
            (element.listLevel
              ? listParticle.LIST_INDENT_WIDTH * element.listLevel * scale
              : 0)
          row.listIndex = listIndexMap.get(element.listId!) ?? 0
        }

        row.offsetY =
          !isFromTable &&
          element.area?.top &&
          element.areaId !== elements[i - 1]?.areaId
            ? element.area.top * scale
            : 0
        resultRowList.push(row)
      } else {
        curRow.width += metrics.width
        if (
          i === 0 &&
          (getIsBlockElement(elements[1]) || !!elements[1]?.areaId)
        ) {
          curRow.height = defaultBasicRowMarginHeight
          curRow.ascent = defaultBasicRowMarginHeight
        } else if (curRow.height < height) {
          curRow.height = height
          curRow.ascent = ascent
        }
        curRow.elementList.push(rowElement)
      }

      if (isWrap || i === elements.length - 1) {
        const visibleElements = curRow.elementList.filter(
          el => el.value !== ZERO
        )
        const isAllHidden =
          visibleElements.length > 0 &&
          visibleElements.every(
            el => el.hide || el.control?.hide || el.area?.hide
          )
        if (isAllHidden) {
          curRow.height = 0
          curRow.ascent = 0
        }
        curRow.isWidthNotEnough = isWidthNotEnough && !isForceBreak
        if (
          !curRow.isSurround &&
          (preElement?.rowFlex === RowFlex.JUSTIFY ||
            (preElement?.rowFlex === RowFlex.ALIGNMENT &&
              curRow.isWidthNotEnough))
        ) {
          const rowElementList =
            curRow.elementList[0]?.value === ZERO
              ? curRow.elementList.slice(1)
              : curRow.elementList
          const gap =
            (availableWidth - curRow.width) / (rowElementList.length - 1)
          for (let e = 0; e < rowElementList.length - 1; e++) {
            const el = rowElementList[e]
            el.metrics.width += gap
          }
          curRow.width = availableWidth
        }
      }

      if (isWrap) {
        const columnOffset = !layout ? 0 : layout.offsets[currentColumn] || 0
        x = startX + columnOffset
        y += curRow.height
        if (isPagingMode && !isFromTable && pageHeight) {
          const curMainOuterHeight = getMainOuterHeight(pageNo)
          const isOverflow =
            y - pageStartY + curMainOuterHeight + height > pageHeight
          const isPageBreakElement = element.type === ElementType.PAGE_BREAK
          if (isOverflow || isPageBreakElement) {
            if (
              !isPageBreakElement &&
              isColumnEnabled &&
              layout &&
              currentColumn < layout.count - 1
            ) {
              currentColumn += 1
              y = pageStartY
              x = startX + (layout.offsets[currentColumn] || 0)
            } else {
              deleteSurroundElementList(surroundElementList, pageNo)
              pageNo += 1
              currentColumn = 0
              pageStartY = getMargins()[0] + getHeader().getExtraHeight(pageNo)
              y = pageStartY
              x = startX + (layout ? layout.offsets[0] || 0 : 0)
            }
          }
        }
        const nextRow = resultRowList[resultRowList.length - 1]
        if (nextRow && isColumnEnabled && nextRow.columnIndex !== undefined) {
          nextRow.columnIndex = currentColumn
        }
        rowElement.left = 0
        const surroundPosition = position.setSurroundPosition({
          pageNo,
          rowElement,
          row: nextRow,
          rowElementRect: {
            x,
            y,
            height,
            width: metrics.width
          },
          availableWidth,
          surroundElementList
        })
        x = surroundPosition.x
        x += metrics.width
      }
    }

    return resultRowList
  }

  function _computePageList(): IRow[][] {
    const result: IRow[][] = [[]]
    const {
      pageMode,
      pageNumber: { maxPageNo }
    } = mergedOptions
    const height = getHeight()
    let pageNo = 0

    if (pageMode === 'continuity') {
      result[0] = rowList
    } else {
      let pageHeight = getMainOuterHeight(0)
      let prevColumnIndex: number | undefined
      for (let i = 0; i < rowList.length; i++) {
        const row = rowList[i]
        const rowOffsetY = row.offsetY || 0
        const columnChanged =
          prevColumnIndex !== undefined &&
          row.columnIndex !== undefined &&
          row.columnIndex > 0 &&
          row.columnIndex !== prevColumnIndex
        if (columnChanged) {
          pageHeight = getMainOuterHeight(pageNo) + row.height + rowOffsetY
          result[pageNo].push(row)
        } else if (
          row.height + rowOffsetY + pageHeight > height ||
          rowList[i - 1]?.isPageBreak
        ) {
          if (Number.isInteger(maxPageNo) && pageNo >= maxPageNo!) {
            elementList.splice(0, row.startIndex)
            break
          }
          pageNo++
          pageHeight = getMainOuterHeight(pageNo) + row.height + rowOffsetY
          result.push([row])
        } else {
          pageHeight += row.height + rowOffsetY
          result[pageNo].push(row)
        }
        prevColumnIndex = row.columnIndex
      }
    }
    return result
  }

  async function setValue(payload: Partial<IEditorData>): Promise<void> {
    const { header: headerData, main, footer: footerData } = deepClone(payload)
    if (!headerData && !main && !footerData) return
    const zones: IElement[][] = [headerData || [], main || [], footerData || []]
    for (const zone of zones) {
      if (!zone || !zone.length) continue
      await formatElementList(zone, {
        editorOptions: mergedOptions,
        isForceCompensation: true
      })
    }
    if (headerData) {
      if (Array.isArray(clonedData)) {
        clonedData.splice(0, clonedData.length, ...headerData)
      } else {
        clonedData.header = headerData
      }
    }
    if (main) {
      if (Array.isArray(clonedData)) {
        clonedData.splice(0, clonedData.length, ...main)
      } else {
        clonedData.main = main
      }
      elementList.splice(0, elementList.length, ...main)
    }
    if (footerData) {
      if (Array.isArray(clonedData)) {
        clonedData.splice(0, clonedData.length, ...footerData)
      } else {
        clonedData.footer = footerData
      }
    }
    await imageObserver.allSettled()
  }

  function _drawHighlight(ctx2d: Context2d, payload: IDrawRowPayload): void {
    const { rowList, positionList } = payload
    const marginHeight = getDefaultBasicRowMarginHeight()
    const highlightMarginHeight = getHighlightMarginHeight()
    for (let i = 0; i < rowList.length; i++) {
      const curRow = rowList[i]
      for (let j = 0; j < curRow.elementList.length; j++) {
        const element = curRow.elementList[j]
        if (element.highlight) {
          const {
            coordinate: {
              leftTop: [x, y]
            }
          } = positionList[curRow.startIndex + j]
          const offsetX = element.left || 0
          highlight.recordFillInfo(
            ctx2d,
            x - offsetX,
            y + marginHeight - highlightMarginHeight,
            element.metrics.width + offsetX,
            curRow.height - 2 * marginHeight + 2 * highlightMarginHeight,
            element.highlight
          )
          highlight.render(ctx2d)
        }
      }
    }
  }

  function drawRow(ctx2d: Context2d, payload: IDrawRowPayload): void {
    const { rowList, pageNo, positionList, zone, isDrawLineBreak } = payload
    const { scale, table } = mergedOptions

    _drawHighlight(ctx2d, payload)

    for (let i = 0; i < rowList.length; i++) {
      const curRow = rowList[i]
      for (let j = 0; j < curRow.elementList.length; j++) {
        const element = curRow.elementList[j]
        const metrics = element.metrics
        const position = positionList[curRow.startIndex + j]
        if (!position) continue
        const {
          ascent: offsetY,
          coordinate: {
            leftTop: [x, y]
          }
        } = position
        const preElement = curRow.elementList[j - 1]

        if (element.hide || element.control?.hide || element.area?.hide) {
          textParticle.complete()
          continue
        }

        if (element.type === ElementType.IMAGE) {
          textParticle.complete()
          if (
            element.imgDisplay !== ImageDisplay.SURROUND &&
            element.imgDisplay !== ImageDisplay.FLOAT_TOP &&
            element.imgDisplay !== ImageDisplay.FLOAT_BOTTOM
          ) {
            imageParticle.render(ctx2d, element, x, y + offsetY)
          }
        } else if (element.type === ElementType.LATEX) {
          textParticle.complete()
          laTexParticle.render(ctx2d, element, x, y + offsetY)
        } else if (element.type === ElementType.TABLE) {
          tableParticle.render(ctx2d, element, x, y)
        } else if (element.type === ElementType.HYPERLINK) {
          textParticle.complete()
          hyperlinkParticle.render(ctx2d, element, x, y + offsetY)
        } else if (element.type === ElementType.LABEL) {
          textParticle.complete()
          labelParticle.render(ctx2d, element, x, y + offsetY)
        } else if (element.type === ElementType.DATE) {
          const nextElement = curRow.elementList[j + 1]
          if (!preElement || preElement.dateId !== element.dateId) {
            textParticle.complete()
          }
          textParticle.record(ctx2d, element, x, y + offsetY)
          if (!nextElement || nextElement.dateId !== element.dateId) {
            textParticle.complete()
          }
        } else if (element.type === ElementType.SUPERSCRIPT) {
          textParticle.complete()
          superscriptParticle.render(ctx2d, element, x, y + offsetY)
        } else if (element.type === ElementType.SUBSCRIPT) {
          underline.render(ctx2d)
          textParticle.complete()
          subscriptParticle.render(ctx2d, element, x, y + offsetY)
        } else if (element.type === ElementType.SEPARATOR) {
          separatorParticle.render(ctx2d, element, x, y)
        } else if (
          element.type === ElementType.CHECKBOX ||
          element.controlComponent === ControlComponent.CHECKBOX
        ) {
          textParticle.complete()
          checkboxParticle.render({
            ctx2d,
            x,
            y: y + offsetY,
            index: j,
            row: curRow
          })
        } else if (
          element.type === ElementType.RADIO ||
          element.controlComponent === ControlComponent.RADIO
        ) {
          textParticle.complete()
          radioParticle.render({
            ctx2d,
            x,
            y: y + offsetY,
            index: j,
            row: curRow
          })
        } else if (element.type === ElementType.TAB) {
          textParticle.complete()
        } else if (
          element.rowFlex === RowFlex.ALIGNMENT ||
          element.rowFlex === RowFlex.JUSTIFY
        ) {
          textParticle.record(ctx2d, element, x, y + offsetY)
          textParticle.complete()
        } else if (element.type === ElementType.BLOCK) {
          textParticle.complete()
          blockParticle.render()
        } else {
          if (element.left) {
            textParticle.complete()
          }
          textParticle.record(ctx2d, element, x, y + offsetY)
          if (
            element.width ||
            element.letterSpacing ||
            PUNCTUATION_REG.test(element.value)
          ) {
            textParticle.complete()
          }
        }

        if (element.underline || element.control?.underline) {
          if (
            preElement?.type === ElementType.SUBSCRIPT &&
            element.type !== ElementType.SUBSCRIPT
          ) {
            underline.render(ctx2d)
          }
          const rowMargin = getElementRowMargin(element)
          const offsetX = element.left || 0
          let underlineOffsetY = 0
          if (element.type === ElementType.SUBSCRIPT) {
            underlineOffsetY = subscriptParticle.getOffsetY(element)
          }
          const color =
            element.controlComponent === ControlComponent.PLACEHOLDER
              ? undefined
              : element.color
          underline.recordFillInfo(
            ctx2d,
            x - offsetX,
            y + curRow.height - rowMargin + underlineOffsetY,
            metrics.width + offsetX,
            0,
            color,
            element.textDecoration?.style
          )
        } else if (preElement?.underline || preElement?.control?.underline) {
          underline.render(ctx2d)
        }

        if (element.strikeout) {
          if (
            !element.type ||
            [
              'text',
              'hyperlink',
              'subscript',
              'superscript',
              'control',
              'date'
            ].includes(element.type)
          ) {
            if (
              preElement &&
              ((preElement.type === ElementType.SUBSCRIPT &&
                element.type !== ElementType.SUBSCRIPT) ||
                (preElement.type === ElementType.SUPERSCRIPT &&
                  element.type !== ElementType.SUPERSCRIPT) ||
                getElementSize(preElement) !== getElementSize(element))
            ) {
              strikeout.render(ctx2d)
            }
            const standardMetrics = textParticle.measureBasisWord(
              ctx2d,
              getFont(element)
            )
            let adjustY =
              y +
              offsetY +
              standardMetrics.actualBoundingBoxDescent * scale -
              metrics.height / 2
            if (element.type === ElementType.SUBSCRIPT) {
              adjustY += subscriptParticle.getOffsetY(element)
            } else if (element.type === ElementType.SUPERSCRIPT) {
              adjustY += superscriptParticle.getOffsetY(element)
            }
            strikeout.recordFillInfo(ctx2d, x, adjustY, metrics.width)
          }
        } else if (preElement?.strikeout) {
          strikeout.render(ctx2d)
        }

        if (element.type === ElementType.TABLE && element.trList) {
          const tdPaddingWidth = table.tdPadding[1] + table.tdPadding[3]
          for (let t = 0; t < element.trList.length; t++) {
            const tr = element.trList[t]
            const tdList = tr.tdList || []
            for (let d = 0; d < tdList.length; d++) {
              const td = tdList[d]
              if (!td.rowList || !td.positionList) continue
              drawRow(ctx2d, {
                elementList: td.value || [],
                rowList: td.rowList,
                pageNo,
                positionList: td.positionList,
                startIndex: 0,
                innerWidth: (td.width! - tdPaddingWidth) * scale,
                zone,
                isDrawLineBreak
              })
            }
          }
        }
      }

      if (curRow.isList) {
        listParticle.drawListStyle(
          ctx2d,
          curRow,
          positionList[curRow.startIndex]
        )
      }

      textParticle.complete()
      underline.render(ctx2d)
      strikeout.render(ctx2d)
      group.render()
    }
  }

  function _drawPage(payload: IDrawPagePayload): void {
    const { rowList, pageNo } = payload
    const {
      pageMode,
      header: headerOpt,
      footer: footerOpt,
      pageNumber: pageNumberOpt,
      lineNumber: lineNumberOpt,
      pageBorder: pageBorderOpt
    } = mergedOptions
    const isContinuityMode = pageMode === 'continuity'
    const ctx2d = getCtx2d()
    pdf.setPage(pageNo + 1)
    _clearPage(pageNo)

    if (!mergedOptions.modeRule?.backgroundDisabled) {
      background.render(ctx2d, pageNo)
    }

    if (
      !isContinuityMode &&
      mergedOptions.watermark.data &&
      mergedOptions.watermark.layer === 'bottom'
    ) {
      waterMark.render(ctx2d, pageNo)
    }

    columnManager.drawSeparator(ctx2d, pageNo)

    if (rowList.length) {
      const positionList = position.getOriginalMainPositionList()
      drawRow(ctx2d, {
        elementList,
        rowList,
        pageNo,
        positionList,
        startIndex: rowList[0]?.startIndex,
        innerWidth: getInnerWidth(),
        zone: EditorZone.MAIN
      })
    }

    if (pageMode === 'paging') {
      if (!headerOpt.disabled) {
        header.render(ctx2d, pageNo)
      }
      if (!pageNumberOpt.disabled) {
        pageNumber.render(ctx2d, pageNo)
      }
      if (!footerOpt.disabled) {
        footer.render(ctx2d, pageNo)
      }
    }

    if (elementList.length <= 1 && !elementList[0]?.listId) {
      placeholder.render(ctx2d)
    }

    if (!lineNumberOpt.disabled) {
      lineNumber.render(ctx2d, pageNo)
    }

    if (!pageBorderOpt.disabled) {
      pageBorder.render(ctx2d)
    }

    if (
      !isContinuityMode &&
      mergedOptions.watermark.data &&
      mergedOptions.watermark.layer === 'top'
    ) {
      waterMark.render(ctx2d, pageNo)
    }
  }

  function _immediateRender(): void {
    for (let i = 0; i < pageRowList.length; i++) {
      _drawPage({ rowList: pageRowList[i], pageNo: i })
    }
  }

  function render(): void {
    filterAssistElement(elementList)
    if (clonedData.header) filterAssistElement(clonedData.header)
    if (clonedData.footer) filterAssistElement(clonedData.footer)
    _resetPdf()
    const { header: headerOpt, footer: footerOpt } = mergedOptions
    const isPagingMode = mergedOptions.pageMode === 'paging'
    position.setFloatPositionList([])
    if (isPagingMode) {
      columnManager.compute()
      if (!headerOpt.disabled) {
        header.compute()
      }
      if (!footerOpt.disabled) {
        footer.compute()
      }
    }
    const margins = getMargins()
    const innerWidth = getInnerWidth()
    const pageHeight = getHeight()
    const extraHeight = header.getExtraHeight()
    const startX = margins[3]
    const startY = margins[0] + extraHeight
    const surroundElementList = pickSurroundElementList(elementList)
    rowList = computeRowList({
      startX,
      startY,
      pageHeight,
      isPagingMode,
      innerWidth,
      surroundElementList,
      elementList
    })
    pageRowList = _computePageList()
    position.computePositionList()
    area.compute()
    _syncPageCount()
    _immediateRender()
  }

  function getBlob(): Blob {
    return pdf.output('blob')
  }

  function getBase64(): string {
    return pdf.output('datauristring')
  }

  async function download(filename = 'export.pdf'): Promise<void> {
    await defaultFontsLoadedPromise
    render()
    pdf.save(filename)
  }

  async function toBlob(): Promise<Blob> {
    await defaultFontsLoadedPromise
    render()
    return pdf.output('blob')
  }

  async function toDataUrl(): Promise<string> {
    await defaultFontsLoadedPromise
    render()
    return pdf.output('dataurlstring')
  }

  _resetPdf()

  function getLetterReg(): RegExp {
    return LETTER_REG
  }

  const drawPdfLike = {
    getWidth,
    getHeight,
    getOptions,
    getInnerWidth,
    getMainHeight,
    getMainOuterHeight,
    getMargins,
    getElementSize,
    getHighlightMarginHeight,
    getCtx2d,
    getPageCount,
    getPdf,
    getPosition: () => ({
      getOriginalMainPositionList: () => position.getOriginalMainPositionList(),
      setSurroundPosition: payload => position.setSurroundPosition(payload)
    }),
    getPageRowList,
    measureText,
    getFont,
    getHeader,
    getFooter,
    drawRow,
    computeRowList,
    getLetterReg
  } as IDrawPdfLike & {
    getLetterReg: () => RegExp
    computeRowList: typeof computeRowList
  }

  const position = new Position(drawPdfLike)
  const background = new Background(drawPdfLike)
  const group = new Group()
  const area = new Area()
  const underline = new Underline(drawPdfLike)
  const strikeout = new Strikeout(drawPdfLike)
  const highlight = new Highlight(drawPdfLike)
  const imageParticle = new ImageParticle(drawPdfLike)
  const laTexParticle = new LaTexParticle(drawPdfLike)
  const textParticle = new TextParticle(drawPdfLike)
  const tableParticle = new TableParticle(drawPdfLike)
  const pageNumber = new PageNumber(drawPdfLike)
  const lineNumber = new LineNumber(drawPdfLike)
  const waterMark = new Watermark(drawPdfLike)
  const placeholder = new Placeholder(drawPdfLike)
  const header = new Header(drawPdfLike, headerElementList)
  const footer = new Footer(drawPdfLike, footerElementList)
  const hyperlinkParticle = new HyperlinkParticle(drawPdfLike)
  const labelParticle = new LabelParticle(drawPdfLike)
  const separatorParticle = new SeparatorParticle(drawPdfLike)
  const superscriptParticle = new SuperscriptParticle()
  const subscriptParticle = new SubscriptParticle()
  const checkboxParticle = new CheckboxParticle(drawPdfLike)
  const radioParticle = new RadioParticle(drawPdfLike)
  const blockParticle = new BlockParticle()
  const listParticle = new ListParticle(drawPdfLike)
  const pageBorder = new PageBorder(drawPdfLike)
  const columnManager = new ColumnManager(drawPdfLike)

  const { letterClass } = mergedOptions
  LETTER_REG = new RegExp(`[${letterClass.join('')}]`)
  WORD_LIKE_REG = new RegExp(
    `${letterClass.map(letter => `[^${letter}][${letter}]`).join('|')}`
  )

  defaultFontsLoadedPromise = pdfOptions.loadDefaultFonts
    ? _addDefaultFont()
    : Promise.resolve(false)

  const drawPdfInstance: DrawPdfInstance = {
    render,
    getPdf,
    getBlob,
    getBase64,
    downloadFont,
    defaultFontsLoadedPromise,
    getWidth,
    getHeight,
    getOptions,
    getInnerWidth,
    getMainHeight,
    getMainOuterHeight,
    getMargins,
    getElementSize,
    getHighlightMarginHeight,
    getCtx2d,
    getPageCount,
    getPageRowList,
    measureText,
    getFont,
    getHeader,
    getFooter,
    drawRow,
    computeRowList,
    loadDefaultFonts,
    addFont,
    setValue,
    download,
    toBlob,
    toDataUrl
  }

  return drawPdfInstance
}

/**
 * 导出 PDF 文件
 *
 * 便捷函数，一键生成 PDF。内部自动处理字体加载和渲染流程。
 *
 * @param data 编辑器数据（包含 header、main、footer）
 * @param options 编辑器选项（可选）
 * @param pdfOptions PDF 生成选项（可选）
 * @returns jsPDF 实例
 *
 * @example
 * ```typescript
 * import { exportPdf } from './src/export-pdf-fun'
 *
 * const pdf = await exportPdf(editorData, { mode: 'print' }, { loadDefaultFonts: true })
 * const blob = pdf.output('blob')
 * ```
 *
 * @example
 * ```typescript
 * import { exportPdf } from './src/export-pdf-fun'
 *
 * // 直接保存 PDF 文件到本地
 * const pdf = await exportPdf(editorData, { mode: 'print' }, { loadDefaultFonts: true })
 * pdf.save('document.pdf')
 * ```
 *
 * @example
 * ```typescript
 * import { createDrawPdf } from './src/export-pdf-fun'
 *
 * // 添加自定义字体后导出 PDF
 * const drawPdf = createDrawPdf(options, data, { loadDefaultFonts: true })
 * await drawPdf.defaultFontsLoadedPromise
 * // 添加自定义中文字体
 * await drawPdf.addFont(
 *   'https://example.com/fonts/NotoSansSC-Regular.ttf',
 *   'NotoSansSC-Regular.ttf',
 *   'Noto Sans SC',
 *   'normal'
 * )
 * await drawPdf.addFont(
 *   'https://example.com/fonts/NotoSansSC-Bold.ttf',
 *   'NotoSansSC-Bold.ttf',
 *   'Noto Sans SC',
 *   'bold'
 * )
 * drawPdf.render()
 * const pdf = drawPdf.getPdf()
 * pdf.save('document-with-custom-font.pdf')
 * ```
 */
export async function exportPdf(
  data: IEditorData,
  options?: IEditorOption,
  pdfOptions?: PdfOptions
): Promise<jsPDF> {
  const drawPdf = createDrawPdf(options || {}, data, pdfOptions || {})
  await drawPdf.defaultFontsLoadedPromise
  drawPdf.render()
  return drawPdf.getPdf()
}

import Editor from '@hufe921/canvas-editor'

export interface IExportPdfOption {
  fileName?: string
  pdfOptions?: PdfOptions
}

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeExportPdf(options?: IExportPdfOption): void
  }
}

export default function pdfPlugin(editor: Editor) {
  const command = editor.command
  command.executeExportPdf = async (options: IExportPdfOption = {}) => {
    const { fileName = 'export.pdf', pdfOptions = {} } = options
    const { data, options: editorOptions } = command.getValue()
    const drawPdf = createDrawPdf(editorOptions || {}, data as any, pdfOptions)
    await drawPdf.defaultFontsLoadedPromise
    drawPdf.render()
    drawPdf.getPdf().save(fileName)
  }
}
