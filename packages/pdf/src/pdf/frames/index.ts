/**
 * canvas-editor-pdf 框架元素模块
 *
 * 本模块包含页面框架相关的渲染器实现，
 * 如背景、页边距、页码、水印、行号等。
 */

import type { Context2d } from 'jspdf'
import { GState } from 'jspdf'
import type {
  IDrawPdfLike,
  IGraffitiData,
  IColumnOption,
  IColumnLayout,
  DeepRequired,
  IEditorOption
} from '../types'
import { NumberType, WatermarkType, LineNumberStyle } from '../types'
import { convertNumberToChinese } from '../utils'

/**
 * 背景渲染器
 *
 * 负责绘制页面背景，可以是纯色背景或背景图片。
 */
export class Background {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建背景渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染页面背景
   *
   * 根据配置绘制背景图片或纯色背景。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param _pageNo 当前页码
   */
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  public render(ctx2d: Context2d, _pageNo: number): void {
    const { background } = this.draw.getOptions()
    const width = this.draw.getWidth()
    const height = this.draw.getHeight()
    ctx2d.save()
    if (background.image) {
      ctx2d.drawImage(background.image, 0, 0, width, height)
    } else {
      ctx2d.fillStyle = background.color
      ctx2d.fillRect(0, 0, width, height)
    }
    ctx2d.restore()
  }
}

/**
 * 页边距渲染器
 *
 * 负责绘制页边距指示线，在页面四角显示小三角形标记。
 */
export class Margin {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建页边距渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染页边距指示线
   *
   * 在页面的四个角落绘制小三角形标记，指示页边距位置。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param _pageNo 当前页码
   */
  public render(ctx2d: Context2d): void {
    const { margins, scale, marginIndicatorSize, marginIndicatorColor } =
      this.draw.getOptions()
    const width = this.draw.getWidth()
    const height = this.draw.getHeight()
    const [top, right, bottom, left] = margins.map(m => m * scale)
    ctx2d.save()
    ctx2d.strokeStyle = marginIndicatorColor
    ctx2d.lineWidth = 1
    ctx2d.translate(0.5, 0.5)
    const size = marginIndicatorSize * scale
    ctx2d.beginPath()
    ctx2d.moveTo(left, top + size)
    ctx2d.lineTo(left, top)
    ctx2d.lineTo(left + size, top)
    ctx2d.moveTo(width - right - size, top)
    ctx2d.lineTo(width - right, top)
    ctx2d.lineTo(width - right, top + size)
    ctx2d.moveTo(left, height - bottom - size)
    ctx2d.lineTo(left, height - bottom)
    ctx2d.lineTo(left + size, height - bottom)
    ctx2d.moveTo(width - right - size, height - bottom)
    ctx2d.lineTo(width - right, height - bottom)
    ctx2d.lineTo(width - right, height - bottom - size)
    ctx2d.stroke()
    ctx2d.restore()
  }
}

/**
 * 页码渲染器
 *
 * 负责在页面底部绘制页码信息，支持自定义格式和起始页码。
 */
export class PageNumber {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建页码渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染页码
   *
   * 根据配置在页面底部居中绘制页码，支持自定义格式字符串。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码（从 0 开始）
   */
  public render(ctx2d: Context2d, pageNo: number): void {
    const { pageNumber, scale } = this.draw.getOptions()
    if (pageNo < (pageNumber.fromPageNo || 0)) return
    const totalPages = this.draw.getPageCount()
    const width = this.draw.getWidth()
    const height = this.draw.getHeight()
    const bottom = pageNumber.bottom * scale
    const size = (pageNumber.size || 12) * scale
    const font = (pageNumber.font || 'Microsoft YaHei').toLowerCase()
    const startPageNo = pageNumber.startPageNo || 0
    const format = pageNumber.format || `{pageNo} / {pageCount}`
    const text = format
      .replace(/\{pageNo\}/g, String(pageNo + 1 + startPageNo))
      .replace(/\{pageCount\}/g, String(totalPages + startPageNo))
    ctx2d.save()
    ctx2d.font = `${size}px ${font}`
    ctx2d.fillStyle = pageNumber.color || '#000000'
    this.draw.getPdf().setFont(font, '', 'normal')
    ctx2d.textAlign = 'center'
    ctx2d.fillText(text, width / 2, height - bottom)
    ctx2d.restore()
  }
}

/**
 * 行号渲染器
 *
 * 负责在页面左侧绘制行号，支持自定义样式和禁用选项。
 */
export class LineNumber {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建行号渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染行号
   *
   * 在页面左侧按行绘制数字编号。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  public render(ctx2d: Context2d, pageNo: number): void {
    const { lineNumber, scale, margins } = this.draw.getOptions()
    if (lineNumber.disabled || lineNumber.style === LineNumberStyle.NONE) return
    const positionList = this.draw.getPosition().getOriginalMainPositionList()
    const rowList = this.draw.getPageRowList()[pageNo] || []
    const fontSize = 12 * scale
    ctx2d.save()
    ctx2d.font = `${fontSize}px microsoft yahei`
    ctx2d.fillStyle = '#CCCCCC'
    ctx2d.textAlign = 'right'
    let seq = 0
    for (let i = 0; i < rowList.length; i++) {
      const row = rowList[i]
      const position = positionList[row.startIndex] as {
        coordinate: { leftBottom: number[] }
      }
      if (!position) continue
      seq++
      const text = String(seq)
      const textWidth = this.draw.measureText(
        `${fontSize}px microsoft yahei`,
        text
      ).width
      const x = margins[3] * scale - (textWidth + 5) * 1
      const y = position.coordinate.leftBottom[1] - 2 * scale
      ctx2d.fillText(text, x, y)
    }
    ctx2d.restore()
  }
}

/**
 * 水印渲染器
 *
 * 负责在页面上绘制文字水印，支持透明度、旋转和重复排列。
 */
export class Watermark {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /**
   * 创建水印渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
    this.options = draw.getOptions()
  }

  /**
   * 渲染水印
   *
   * 根据配置绘制文字水印，支持中文数字格式。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  public render(ctx2d: Context2d, pageNo: number): void {
    const { watermark } = this.options
    if (!watermark.data || watermark.disabled) return
    if (watermark.type === WatermarkType.IMAGE) return
    this.renderText(ctx2d, pageNo)
  }

  /**
   * 渲染文字水印
   *
   * 支持单水印和重复水印两种模式，水印旋转 45 度。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  private renderText(ctx2d: Context2d, pageNo: number): void {
    const {
      watermark: { data, opacity, font, size, color, repeat, gap, numberType },
      scale
    } = this.options
    const width = this.draw.getWidth()
    const height = this.draw.getHeight()
    const totalPages = this.draw.getPageCount()
    const fontString = `${size * scale}px ${font}`
    const text = data
      .replace(/\{pageNo\}/g, String(pageNo + 1))
      .replace(
        /\{pageCount\}/g,
        numberType === NumberType.CHINESE
          ? convertNumberToChinese(totalPages)
          : String(totalPages)
      )

    ctx2d.save()
    this.draw.getPdf().setGState(new GState({ opacity }))
    ctx2d.globalAlpha = opacity
    ctx2d.font = fontString
    ctx2d.fillStyle = color

    const metrics = this.draw.measureText(fontString, text)
    const textWidth = metrics.width
    const textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

    const drawRotated = (cx: number, cy: number): void => {
      ctx2d.save()
      ctx2d.translate(cx, cy)
      ctx2d.rotate((-45 * Math.PI) / 180)
      ctx2d.fillText(
        text,
        -textWidth / 2,
        (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
      )
      ctx2d.restore()
    }

    if (repeat) {
      const diagonalLength = Math.sqrt(
        Math.pow(textWidth, 2) + Math.pow(textHeight, 2)
      )
      const stepX = diagonalLength + 2 * gap[0] * scale
      const stepY = diagonalLength + 2 * gap[1] * scale
      for (let cy = stepY / 2; cy < height + stepY; cy += stepY) {
        for (let cx = stepX / 2; cx < width + stepX; cx += stepX) {
          drawRotated(cx, cy)
        }
      }
    } else {
      drawRotated(width / 2, height / 2)
    }
    this.draw.getPdf().setGState(new GState({ opacity: 1 }))
    ctx2d.restore()
  }
}

/**
 * 占位符渲染器
 *
 * 负责在空页面上显示占位文本，提示用户可以添加内容。
 */
export class Placeholder {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建占位符渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染占位符文本
   *
   * 在页面居中位置绘制占位文本。
   *
   * @param ctx2d Canvas 2D 上下文
   */
  public render(ctx2d: Context2d): void {
    const { placeholder, scale } = this.draw.getOptions()
    if (!placeholder.value) return
    const width = this.draw.getInnerWidth()
    const margins = this.draw.getMargins()
    const header = this.draw.getHeader() as { getExtraHeight: () => number }
    const height = this.draw.getHeight() - margins[0] - margins[2]
    ctx2d.save()
    ctx2d.font = `${16 * scale}px microsoft yahei`
    ctx2d.fillStyle = placeholder.color || '#CCCCCC'
    ctx2d.textAlign = 'center'
    ctx2d.textBaseline = 'middle'
    ctx2d.fillText(
      placeholder.value,
      margins[3] + width / 2,
      margins[0] + header.getExtraHeight() + height / 2
    )
    ctx2d.restore()
  }
}

/**
 * 页面边框渲染器
 *
 * 负责在页面内容区域绘制边框。
 */
export class PageBorder {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建页面边框渲染器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染页面边框
   *
   * 在内容区域外围绘制矩形边框。
   *
   * @param ctx2d Canvas 2D 上下文
   */
  public render(ctx2d: Context2d): void {
    const { pageBorder, margins, scale } = this.draw.getOptions()
    if (pageBorder.disabled) return
    const width = this.draw.getWidth()
    const height = this.draw.getHeight()
    const header = this.draw.getHeader() as { getExtraHeight: () => number }
    const footer = this.draw.getFooter() as { getExtraHeight: () => number }
    const x = margins[3] * scale
    const y = (margins[0] + header.getExtraHeight()) * scale
    const w = width - (margins[1] + margins[3]) * scale
    const h = height - y - (margins[2] + footer.getExtraHeight()) * scale
    ctx2d.save()
    ctx2d.strokeStyle = pageBorder.color || '#CCCCCC'
    ctx2d.lineWidth = (pageBorder.lineWidth || 1) * scale
    ctx2d.translate(0.5, 0.5)
    ctx2d.rect(x, y, w, h)
    ctx2d.stroke()
    ctx2d.restore()
  }
}

/**
 * 分组渲染器
 *
 * PDF 路径下不绘制（DOM 编辑器专属）。
 */
export class Group {
  /**
   * 记录填充信息（空实现）
   */
  public recordFillInfo(): void {
    /* Group 在 PDF 路径下不绘制 */
  }

  /**
   * 渲染分组（空实现）
   *
   * Group 是 DOM 编辑器专属功能，PDF 中不需要绘制。
   */
  public render(): void {
    /* Group 在 PDF 路径下不绘制 */
  }
}

/**
 * 区域渲染器
 *
 * PDF 路径下不绘制（DOM 编辑器专属）。
 */
export class Area {
  /**
   * 计算区域信息（空实现）
   */
  public compute(): void {
    /* Area 在 PDF 路径下不绘制 */
  }

  /**
   * 获取区域信息
   *
   * @returns 空的区域信息映射
   */
  public getAreaInfo(): Map<string, unknown> {
    return new Map()
  }

  /**
   * 渲染区域（空实现）
   *
   * Area 是 DOM 编辑器专属功能，PDF 中不需要绘制。
   */
  public render(): void {
    /* Area 在 PDF 路径下不绘制 */
  }
}

/**
 * 涂鸦渲染器
 *
 * 负责涂鸦数据的管理，PDF 路径下不渲染涂鸦内容。
 */
export class Graffiti {
  /** 涂鸦数据列表 */
  private data: IGraffitiData[]

  /**
   * 创建涂鸦渲染器实例
   *
   * @param _draw DrawPdf 实例引用
   * @param data 涂鸦数据列表
   */
  constructor(_draw: IDrawPdfLike, data?: IGraffitiData[]) {
    this.data = data || []
  }

  /**
   * 获取涂鸦数据
   *
   * @returns 涂鸦数据列表
   */
  public getValue(): IGraffitiData[] {
    return this.data
  }

  /**
   * 计算涂鸦位置（空实现）
   */
  public compute(): void {
    /* Graffiti 在 PDF 路径下不计算 */
  }

  /**
   * 渲染涂鸦（空实现）
   *
   * Graffiti 在 PDF 路径下不渲染，仅保留接口兼容性。
   */
  public render(): void {
    /* Graffiti 渲染省略，仅保留接口 */
  }
}

/**
 * 图片观察者
 *
 * 负责收集和管理图片加载的 Promise，确保所有图片加载完成后再进行渲染。
 */
export class ImageObserver {
  /** 图片加载 Promise 列表 */
  private promiseList: Promise<unknown>[] = []

  /**
   * 添加图片加载 Promise
   *
   * @param payload 图片加载 Promise
   */
  public add(payload: Promise<unknown>): void {
    this.promiseList.push(payload)
  }

  /**
   * 清空所有 Promise
   */
  public clearAll(): void {
    this.promiseList = []
  }

  /**
   * 等待所有图片加载完成
   *
   * @returns 所有 Promise 的 settle 结果
   */
  public allSettled(): Promise<PromiseSettledResult<unknown>[]> {
    return Promise.allSettled(this.promiseList)
  }
}

/**
 * 分栏管理器
 *
 * 负责计算和管理页面分栏布局，支持分栏宽度、间距和分隔线。
 */
export class ColumnManager {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /** 当前分栏布局 */
  private layout: IColumnLayout | null = null

  /**
   * 创建分栏管理器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
    this.options = draw.getOptions()
  }

  /**
   * 获取当前分栏布局
   *
   * @returns 分栏布局信息
   */
  public getLayout(): IColumnLayout | null {
    return this.layout
  }

  /**
   * 获取指定列的偏移量
   *
   * @param columnIndex 列索引
   * @returns 列偏移量（像素）
   */
  public getOffset(columnIndex: number): number {
    if (!this.layout) return 0
    if (columnIndex < 0 || columnIndex >= this.layout.offsets.length) return 0
    return this.layout.offsets[columnIndex]
  }

  /**
   * 计算分栏布局
   *
   * 根据页面宽度和配置计算分栏的宽度、间距和偏移量。
   */
  public compute(): void {
    this.layout = this.computeLayout(
      this.draw.getInnerWidth(),
      this.options.column
    )
  }

  /**
   * 计算分栏布局
   *
   * @param innerWidth 页面内部宽度
   * @param config 分栏配置
   * @returns 分栏布局信息
   */
  public computeLayout(
    innerWidth: number,
    config: IColumnOption
  ): IColumnLayout | null {
    if (!config) return null
    const count = Math.max(1, Math.floor(config.count))
    if (count === 1) return null
    const rawGap = (config.gap ?? this.options.column.gap) * this.options.scale
    const maxGap = (innerWidth / count) * 0.5
    const gap = Math.max(0, Math.min(rawGap, maxGap))
    const width = (innerWidth - gap * (count - 1)) / count
    const offsets: number[] = []
    for (let i = 0; i < count; i++) {
      offsets.push(i * (width + gap))
    }
    return {
      count,
      width,
      gap,
      separator: config.separator ?? false,
      separatorColor: config.separatorColor,
      separatorWidth: config.separatorWidth,
      offsets
    }
  }

  /**
   * 绘制分栏分隔线
   *
   * 在分栏之间绘制垂直分隔线。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  public drawSeparator(ctx2d: Context2d, pageNo: number): void {
    if (!this.layout || !this.layout.separator) return
    const margins = this.draw.getMargins()
    const { scale } = this.options
    const height = this.draw.getHeight()
    const header = this.draw.getHeader()
    const footer = this.draw.getFooter()
    const top = (margins[0] + header.getExtraHeight(pageNo)) * scale
    const bottom = (margins[2] + footer.getExtraHeight(pageNo)) * scale
    ctx2d.save()
    ctx2d.strokeStyle = this.layout.separatorColor || '#CCCCCC'
    ctx2d.lineWidth = (this.layout.separatorWidth || 1) * scale
    ctx2d.translate(0.5, 0.5)
    for (let i = 1; i < this.layout.count; i++) {
      const x =
        margins[3] * scale + this.layout.offsets[i] - this.layout.gap / 2
      ctx2d.beginPath()
      ctx2d.moveTo(x, top)
      ctx2d.lineTo(x, height - bottom)
      ctx2d.stroke()
    }
    ctx2d.restore()
  }
}
