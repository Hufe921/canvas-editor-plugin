/**
 * canvas-editor-pdf 粒子渲染器模块
 *
 * 本模块包含各种元素类型的渲染器实现，
 * 负责将不同类型的元素（文本、图片、表格、列表等）绘制到 PDF 上。
 */

import type { Context2d } from 'jspdf'
import type {
  IDrawPdfLike,
  IElement,
  IRowElement,
  IRow,
  ITr,
  ITd,
  DeepRequired,
  IEditorOption,
  IElementPosition
} from '../types'
import {
  UlStyle,
  ListStyle,
  ListType,
  ElementType,
  ZERO,
  KeyMap,
  VerticalAlign
} from '../types'
import {
  METRICS_BASIS_TEXT,
  deepClone,
  ulStyleMapping,
  PUNCTUATION_LIST,
  NBSP
} from '../utils'
import { type ExportOpt, LaTexUtils } from '../utils/latex'

/**
 * 文本粒子渲染器
 *
 * 负责文本元素的测量和渲染，支持文本缓存优化和样式合并。
 */
export class TextParticle {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /** Canvas 2D 上下文引用 */
  private ctx2d: Context2d

  /** 当前渲染的起始 X 坐标 */
  private curX = -1

  /** 当前渲染的起始 Y 坐标 */
  private curY = -1

  /** 当前累积的文本内容 */
  private text = ''

  /** 当前文本是否加粗 */
  private bold = false

  /** 当前文本是否斜体 */
  private italic = false

  /** 当前文本样式（CSS font 字符串） */
  private curStyle = ''

  /** 当前文本颜色 */
  private curColor?: string

  /** 文本测量结果缓存 */
  public cacheMeasureText: Map<string, TextMetrics> = new Map()

  /**
   * 创建文本粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
    this.options = draw.getOptions()
    this.ctx2d = draw.getCtx2d() as Context2d
  }

  /**
   * 测量基准字符的字体度量信息
   *
   * 使用中文字符"中"作为基准测量字体的 ascent/descent 等信息。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param font CSS font 字符串
   * @returns 文本度量信息
   */
  public measureBasisWord(ctx2d: Context2d, font: string): TextMetrics {
    ctx2d.save()
    ctx2d.font = font
    const textMetrics = this.measureText(ctx2d, {
      value: METRICS_BASIS_TEXT
    })
    ctx2d.restore()
    return textMetrics
  }

  /**
   * 完成当前文本渲染
   *
   * 将累积的文本内容渲染到画布上，并清空缓存。
   */
  public complete(): void {
    this._render()
    this.text = ''
  }

  /**
   * 记录文本元素信息用于批量渲染
   *
   * 将文本元素添加到缓存中，当样式或颜色变化时自动触发渲染。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 文本元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public record(
    ctx2d: Context2d,
    element: IRowElement,
    x: number,
    y: number
  ): void {
    this.ctx2d = ctx2d
    const elementStyle = this.draw.getFont(element, this.options.scale)
    if (this.options.renderMode === 'compatibility') {
      this.curX = x
      this.curY = y
      this.text = element.value
      this.curStyle = elementStyle
      this.curColor = element.color
      this.bold = !!element.bold
      this.italic = !!element.italic
      this.complete()
      return
    }
    if (!this.text) {
      this.curX = x
      this.curY = y
    }
    if (
      (this.curStyle && elementStyle !== this.curStyle) ||
      element.color !== this.curColor
    ) {
      this.complete()
      this.curX = x
      this.curY = y
    }
    this.text += element.value
    this.curStyle = elementStyle.toLocaleLowerCase()
    this.curColor = element.color
    this.bold = !!element.bold
    this.italic = !!element.italic
  }

  /**
   * 渲染当前累积的文本内容
   *
   * 将缓存的文本内容绘制到画布上，设置字体、颜色等样式。
   */
  private _render(): void {
    if (!this.text || !~this.curX || !~this.curY) return
    this.ctx2d.save()
    this.ctx2d.font = this.curStyle.toLowerCase()
    const fontWeight = this.bold ? 'bold' : 'normal'
    const fontItalic = this.italic ? 'italic' : ''
    this.draw
      .getPdf()
      .setFont(this.curStyle.split('px ')[1], fontItalic, fontWeight)
    this.draw.getPdf().setCharSpace(0.1)
    this.ctx2d.fillStyle = this.curColor || this.options.defaultColor
    this.ctx2d.fillText(this.text, this.curX, this.curY)
    this.ctx2d.restore()
  }

  /**
   * 测量文本元素的宽度和高度
   *
   * 使用缓存机制避免重复测量，提升性能。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 待测量的元素
   * @returns 文本度量信息
   */
  public measureText(ctx2d: Context2d, element: IElement): TextMetrics {
    const font = this.draw.getFont(element)
    const value = element.value === `\n` ? '' : element.value
    if (element.width) {
      const textMetrics = this.draw.measureText(font, element.value)
      return {
        width: element.width,
        actualBoundingBoxAscent: textMetrics.actualBoundingBoxAscent,
        actualBoundingBoxDescent: textMetrics.actualBoundingBoxDescent,
        actualBoundingBoxLeft: (textMetrics as any).actualBoundingBoxLeft,
        actualBoundingBoxRight: (textMetrics as any).actualBoundingBoxRight,
        fontBoundingBoxAscent: (textMetrics as any).fontBoundingBoxAscent,
        fontBoundingBoxDescent: (textMetrics as any).fontBoundingBoxDescent
      } as TextMetrics
    }
    const id = `${element.value}${ctx2d.font}`
    const cacheTextMetrics = this.cacheMeasureText.get(id)
    if (cacheTextMetrics) {
      return cacheTextMetrics
    }
    const textMetrics = this.draw.measureText(font, value)
    this.cacheMeasureText.set(id, textMetrics)
    return textMetrics
  }

  /**
   * 测量连续单词的总宽度
   *
   * 从当前位置开始，测量连续的字母序列宽度，直到遇到非字母字符为止。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param elementList 元素列表
   * @param curIndex 当前索引
   * @returns 单词宽度和结束元素
   */
  public measureWord(
    ctx2d: Context2d,
    elementList: IElement[],
    curIndex: number
  ): { width: number; endElement: IElement | null } {
    const LETTER_REG = (this.draw as any).getLetterReg?.() || /[a-zA-Z]/
    let width = 0
    let endElement: IElement | null = null
    let i = curIndex
    while (i < elementList.length) {
      const element = elementList[i]
      if (
        (element.type && element.type !== ElementType.TEXT) ||
        !LETTER_REG.test(element.value)
      ) {
        endElement = element
        break
      }
      width += this.measureText(ctx2d, element).width
      i++
    }
    return { width, endElement }
  }

  /**
   * 测量标点符号的宽度
   *
   * 如果元素值是标点符号，则返回其宽度；否则返回 0。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 待测量的元素
   * @returns 标点符号宽度
   */
  public measurePunctuationWidth(ctx2d: Context2d, element: IElement): number {
    if (!element || !PUNCTUATION_LIST.includes(element.value)) return 0
    ctx2d.font = this.draw.getFont(element)
    return this.measureText(ctx2d, element).width
  }

  /**
   * 获取基准字符的上标高度
   *
   * @param ctx2d Canvas 2D 上下文
   * @param font CSS font 字符串
   * @returns 基准字符的上标高度
   */
  public getBasisWordBoundingBoxAscent(ctx2d: Context2d, font: string): number {
    return this.measureBasisWord(ctx2d, font).actualBoundingBoxAscent
  }
}

/**
 * 图片粒子渲染器
 *
 * 负责图片元素的渲染，支持缩放和定位。
 */
export class ImageParticle {
  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /**
   * 创建图片粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.options = draw.getOptions()
  }

  /**
   * 渲染图片元素
   *
   * 将图片绘制到指定位置，根据 scale 进行缩放。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 图片元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IElement,
    x: number,
    y: number
  ): void {
    if (!element.value) return
    const { scale } = this.options
    const width = element.width! * scale
    const height = element.height! * scale
    ctx2d.drawImage(element.value, x, y, width, height)
  }
}

const EXPORT_OPT: ExportOpt = {
  SCALE_X: 10,
  SCALE_Y: 10,
  MARGIN_X: 0,
  MARGIN_Y: 0
}

export interface LaTexPolylines {
  polylines: number[][][]
  width: number
  height: number
}

/**
 * LaTeX 公式粒子渲染器
 *
 * 负责将 LaTeX 公式解析为向量路径并渲染到 PDF 上。
 */
export class LaTexParticle {
  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /**
   * 创建 LaTeX 粒子实例
   *
   * @param _draw DrawPdf 实例引用
   */
  constructor(_draw: IDrawPdfLike) {
    this.options = _draw.getOptions()
  }

  /**
   * 将 LaTeX 公式转换为多边形路径数据
   *
   * @param laTex LaTeX 公式字符串
   * @returns 多边形路径数据及尺寸信息
   */
  public static convertLaTextToPolylines(laTex: string): LaTexPolylines {
    const util = new LaTexUtils(laTex)
    const box = util.box(EXPORT_OPT)
    return {
      polylines: util.polylines(EXPORT_OPT),
      width: Math.ceil(box.w),
      height: Math.ceil(box.h)
    }
  }

  /**
   * 渲染 LaTeX 公式
   *
   * 将 LaTeX 公式解析为向量路径后直接绘制到画布上，无需 SVG→PNG 转换。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element LaTeX 元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IElement,
    x: number,
    y: number
  ): void {
    if (element.type !== ElementType.LATEX) return
    const { scale } = this.options
    const width = element.width! * scale
    const height = element.height! * scale
    ctx2d.clearRect(x, y, width, height)
    const {
      polylines,
      width: svgWidth,
      height: svgHeight
    } = LaTexParticle.convertLaTextToPolylines(element.value)
    if (!polylines.length || !svgWidth || !svgHeight) return
    const sx = width / svgWidth
    const sy = height / svgHeight
    ctx2d.save()
    ctx2d.beginPath()
    ctx2d.strokeStyle = element.color || 'black'
    ctx2d.lineWidth = sx
    ctx2d.lineCap = 'round'
    ctx2d.lineJoin = 'round'
    for (let i = 0; i < polylines.length; i++) {
      const line = polylines[i]
      for (let j = 0; j < line.length; j++) {
        const px = x + line[j][0] * sx
        const py = y + line[j][1] * sy
        if (j === 0) {
          ctx2d.moveTo(px, py)
        } else {
          ctx2d.lineTo(px, py)
        }
      }
    }
    ctx2d.stroke()
    ctx2d.restore()
  }
}

/**
 * 超链接粒子渲染器
 *
 * 负责超链接文本的渲染，支持自定义颜色。
 */
export class HyperlinkParticle {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建超链接粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染超链接文本
   *
   * 超链接文本默认显示为蓝色，支持自定义颜色。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 超链接元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IRowElement,
    x: number,
    y: number
  ): void {
    const { defaultHyperlinkColor } = this.draw.getOptions()
    ctx2d.save()
    ctx2d.font = element.style.toLowerCase()
    const fontItalic = element.italic ? 'italic' : ''
    const fontWeight = element.bold ? 'bold' : 'normal'
    this.draw
      .getPdf()
      .setFont(element.style.split('px ')[1], fontItalic, fontWeight)
    ctx2d.fillStyle = element.color || defaultHyperlinkColor
    ctx2d.fillText(element.value, x, y)
    ctx2d.restore()
  }
}

/**
 * 分隔线粒子渲染器
 *
 * 负责水平分隔线的绘制，支持自定义线宽和颜色。
 */
export class SeparatorParticle {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建分隔线粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染分隔线
   *
   * 绘制一条贯穿页面宽度的水平分隔线。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 分隔线元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IElement,
    x: number,
    y: number
  ): void {
    const { separator, scale } = this.draw.getOptions()
    const lineWidth = (element.lineWidth || separator.lineWidth) * scale
    ctx2d.save()
    ctx2d.strokeStyle = element.color || separator.strokeStyle
    ctx2d.lineWidth = lineWidth
    ctx2d.translate(0, lineWidth / 2)
    ctx2d.beginPath()
    ctx2d.moveTo(x, Math.round(y))
    ctx2d.lineTo(x + element.width! * scale, Math.round(y))
    ctx2d.stroke()
    ctx2d.restore()
  }
}

/**
 * 上标粒子渲染器
 *
 * 负责上标文本的渲染，自动计算偏移位置。
 */
export class SuperscriptParticle {
  /**
   * 获取上标偏移量
   *
   * 上标文本向上偏移半个元素高度。
   *
   * @param element 上标元素
   * @returns Y 轴偏移量（负数表示向上）
   */
  public getOffsetY(element: IRowElement): number {
    return -element.metrics.height / 2
  }

  /**
   * 渲染上标文本
   *
   * 将文本向上偏移并缩小字号后绘制。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 上标元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IRowElement,
    x: number,
    y: number
  ): void {
    ctx2d.save()
    ctx2d.font = element.style.toLowerCase()
    ctx2d.fillStyle = element.color || '#000000'
    ctx2d.fillText(element.value, x, y + this.getOffsetY(element))
    ctx2d.restore()
  }
}

/**
 * 下标粒子渲染器
 *
 * 负责下标文本的渲染，自动计算偏移位置。
 */
export class SubscriptParticle {
  /**
   * 获取下标偏移量
   *
   * 下标文本向下偏移半个元素高度。
   *
   * @param element 下标元素
   * @returns Y 轴偏移量（正数表示向下）
   */
  public getOffsetY(element: IRowElement): number {
    return element.metrics.height / 2
  }

  /**
   * 渲染下标文本
   *
   * 将文本向下偏移并缩小字号后绘制。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 下标元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IRowElement,
    x: number,
    y: number
  ): void {
    ctx2d.save()
    ctx2d.font = element.style.toLowerCase()
    ctx2d.fillStyle = element.color || '#000000'
    ctx2d.fillText(element.value, x, y + this.getOffsetY(element))
    ctx2d.restore()
  }
}

/**
 * 复选框粒子渲染器
 *
 * 负责复选框控件的绘制，支持 verticalAlign 垂直对齐、
 * 选中状态填充背景与对勾绘制。
 */
export class CheckboxParticle {
  private options: DeepRequired<IEditorOption>

  constructor(draw: IDrawPdfLike) {
    this.options = draw.getOptions()
  }

  public render(payload: {
    ctx2d: Context2d
    x: number
    y: number
    index: number
    row: IRow
  }) {
    const { ctx2d, x, index, row } = payload
    let { y } = payload
    const {
      checkbox: { gap, lineWidth, fillStyle, strokeStyle, checkFillStyle, checkMarkColor, verticalAlign },
      scale
    } = this.options
    const { metrics, checkbox } = row.elementList[index]
    if (
      verticalAlign === VerticalAlign.TOP ||
      verticalAlign === VerticalAlign.MIDDLE
    ) {
      let nextIndex = index + 1
      let nextElement: IRowElement | null = null
      while (nextIndex < row.elementList.length) {
        nextElement = row.elementList[nextIndex]
        if (nextElement.value !== ZERO && nextElement.value !== NBSP) break
        nextIndex++
      }
      if (nextElement) {
        const {
          metrics: { boundingBoxAscent, boundingBoxDescent }
        } = nextElement
        const textHeight = boundingBoxAscent + boundingBoxDescent
        if (textHeight > metrics.height) {
          if (verticalAlign === VerticalAlign.TOP) {
            y -= boundingBoxAscent - metrics.height
          } else if (verticalAlign === VerticalAlign.MIDDLE) {
            y -= (textHeight - metrics.height) / 2
          }
        }
      }
    }
    const left = Math.round(x + gap * scale)
    const top = Math.round(y - metrics.height + lineWidth)
    const width = metrics.width - gap * 2 * scale
    const height = metrics.height
    ctx2d.save()
    if (checkbox?.value) {
      ctx2d.fillStyle = checkFillStyle || fillStyle
      ctx2d.fillRect(left, top, width, height)
      ctx2d.strokeStyle = checkFillStyle || fillStyle
      ctx2d.lineWidth = lineWidth
      ctx2d.strokeRect(left, top, width, height)
      ctx2d.beginPath()
      ctx2d.strokeStyle = checkMarkColor || strokeStyle
      ctx2d.lineWidth = lineWidth * 2 * scale
      ctx2d.lineCap = 'round'
      ctx2d.lineJoin = 'round'
      ctx2d.moveTo(left + 2 * scale, top + height / 2)
      ctx2d.lineTo(left + width / 2, top + height - 3 * scale)
      ctx2d.lineTo(left + width - 2 * scale, top + 3 * scale)
      ctx2d.stroke()
    } else {
      ctx2d.lineWidth = lineWidth
      ctx2d.strokeRect(left, top, width, height)
    }
    ctx2d.restore()
  }
}

/**
 * 单选框粒子渲染器
 *
 * 负责单选框控件的绘制，支持 verticalAlign 垂直对齐、
 * 选中状态填充内圆。
 */
export class RadioParticle {
  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /**
   * 创建单选框粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.options = draw.getOptions()
  }

  /**
   * 渲染单选框
   *
   * 根据 `verticalAlign` 调整与相邻文本的垂直对齐方式；
   * 选中时外圆用 `fillStyle` 描边并填充内圆。
   *
   * @param payload 渲染参数
   * @param payload.ctx2d Canvas 2D 上下文
   * @param payload.x 起始 X 坐标
   * @param payload.y 基线 Y 坐标
   * @param payload.index 元素索引
   * @param payload.row 当前行信息
   */
  public render(payload: {
    ctx2d: Context2d
    x: number
    y: number
    index: number
    row: IRow
  }): void {
    const { ctx2d, x, index, row } = payload
    let { y } = payload
    const {
      radio: { gap, lineWidth, fillStyle, strokeStyle, checkFillStyle, verticalAlign },
      scale
    } = this.options
    const { metrics, radio } = row.elementList[index]
    if (
      verticalAlign === VerticalAlign.TOP ||
      verticalAlign === VerticalAlign.MIDDLE
    ) {
      let nextIndex = index + 1
      let nextElement: IRowElement | null = null
      while (nextIndex < row.elementList.length) {
        nextElement = row.elementList[nextIndex]
        if (nextElement.value !== ZERO && nextElement.value !== NBSP) break
        nextIndex++
      }
      if (nextElement) {
        const {
          metrics: { boundingBoxAscent, boundingBoxDescent }
        } = nextElement
        const textHeight = boundingBoxAscent + boundingBoxDescent
        if (textHeight > metrics.height) {
          if (verticalAlign === VerticalAlign.TOP) {
            y -= boundingBoxAscent - metrics.height
          } else if (verticalAlign === VerticalAlign.MIDDLE) {
            y -= (textHeight - metrics.height) / 2
          }
        }
      }
    }
    const left = Math.round(x + gap * scale)
    const top = Math.round(y - metrics.height + lineWidth)
    const width = metrics.width - gap * 2 * scale
    const height = metrics.height
    ctx2d.save()
    ctx2d.beginPath()
    ctx2d.translate(0.5, 0.5)
    ctx2d.strokeStyle = radio?.value ? (checkFillStyle || fillStyle) : strokeStyle
    ctx2d.lineWidth = lineWidth
    ctx2d.arc(
      left + width / 2,
      top + height / 2,
      width / 2,
      0,
      Math.PI * 2,
      true
    )
    ctx2d.stroke()
    if (radio?.value) {
      ctx2d.beginPath()
      ctx2d.fillStyle = checkFillStyle || fillStyle
      ctx2d.arc(
        left + width / 2,
        top + height / 2,
        width / 3,
        0,
        Math.PI * 2,
        true
      )
      ctx2d.fill()
    }
    ctx2d.closePath()
    ctx2d.restore()
  }
}

/**
 * 表格粒子渲染器
 *
 * 负责表格元素的计算和渲染，支持合并单元格、边框和背景色。
 */
export class TableParticle {
  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /**
   * 创建表格粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.options = draw.getOptions()
  }

  /**
   * 计算表格行列信息
   *
   * 为每个单元格计算 x、y、width、height 等位置信息，处理合并单元格。
   *
   * @param element 表格元素
   */
  public computeRowColInfo(element: IElement): void {
    const { colgroup, trList } = element
    if (!colgroup || !trList) return
    let preX = 0
    for (let t = 0; t < trList.length; t++) {
      const tr = trList[t]
      const isLastTr = trList.length - 1 === t
      for (let d = 0; d < (tr.tdList || []).length; d++) {
        const td = tr.tdList![d]
        let colIndex = 0
        if (trList.length > 1 && t !== 0) {
          const preTd = tr.tdList![d - 1]
          const start = preTd ? preTd.colIndex! + preTd.colspan : d
          for (let c = start; c < colgroup.length; c++) {
            const rowCount = this.getRowCountByColIndex(trList.slice(0, t), c)
            if (rowCount === t) {
              colIndex = c
              let preColWidth = 0
              for (let preC = 0; preC < c; preC++) {
                preColWidth += colgroup[preC].width || 0
              }
              preX = preColWidth
              break
            }
          }
        } else {
          const preTd = tr.tdList![d - 1]
          if (preTd) {
            colIndex = preTd.colIndex! + preTd.colspan
          }
        }
        let width = 0
        for (let col = 0; col < td.colspan; col++) {
          width += colgroup[col + colIndex].width || 0
        }
        let height = 0
        for (let row = 0; row < td.rowspan; row++) {
          const curTr = trList[row + t] || trList[t]
          height += curTr.height || curTr.minHeight || 0
        }
        const isLastRowTd = (tr.tdList || []).length - 1 === d
        let isLastColTd = isLastTr
        if (!isLastColTd && td.rowspan > 1) {
          const nextTrLength = trList.length - 1 - t
          isLastColTd = td.rowspan - 1 === nextTrLength
        }
        const isLastTd = isLastTr && isLastRowTd
        td.isLastRowTd = isLastRowTd
        td.isLastColTd = isLastColTd
        td.isLastTd = isLastTd
        td.x = preX
        let preY = 0
        for (let preR = 0; preR < t; preR++) {
          const preTdList = trList[preR].tdList || []
          for (let preD = 0; preD < preTdList.length; preD++) {
            const preTd = preTdList[preD]
            if (
              colIndex >= preTd.colIndex! &&
              colIndex < preTd.colIndex! + preTd.colspan
            ) {
              preY += preTd.height || 0
              break
            }
          }
        }
        td.y = preY
        td.width = width
        td.height = height
        td.rowIndex = t
        td.colIndex = colIndex
        td.trIndex = t
        td.tdIndex = d
        preX += width
        if (isLastRowTd && !isLastTd) {
          preX = 0
        }
      }
    }
  }

  /**
   * 根据列索引获取已占用的行数
   *
   * 用于处理合并单元格时计算正确的列位置。
   *
   * @param trList 行列表
   * @param colIndex 列索引
   * @returns 已占用的行数
   */
  public getRowCountByColIndex(trList: ITr[], colIndex: number): number {
    return this.getTdListByColIndex(trList, colIndex).reduce(
      (pre, cur) => pre + cur.rowspan,
      0
    )
  }

  /**
   * 根据列索引获取单元格列表
   *
   * 返回指定列索引上的所有单元格。
   *
   * @param trList 行列表
   * @param colIndex 列索引
   * @returns 单元格列表
   */
  public getTdListByColIndex(trList: ITr[], colIndex: number): ITd[] {
    const data: ITd[] = []
    for (let r = 0; r < trList.length; r++) {
      const tdList = trList[r].tdList || []
      for (let d = 0; d < tdList.length; d++) {
        const td = tdList[d]
        const min = td.colIndex!
        const max = min + td.colspan - 1
        if (colIndex >= min && colIndex <= max) {
          data.push(td)
        }
      }
    }
    return data
  }

  /**
   * 渲染表格
   *
   * 依次调用背景色渲染和边框渲染方法。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 表格元素
   * @param startX 起始 X 坐标
   * @param startY 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IRowElement,
    startX: number,
    startY: number
  ): void {
    this._drawBackgroundColor(ctx2d, element, startX, startY)
    this._drawBorder(ctx2d, element, startX, startY)
  }

  /**
   * 绘制表格背景色
   *
   * 遍历所有单元格，绘制有背景色的单元格。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 表格元素
   * @param startX 起始 X 坐标
   * @param startY 起始 Y 坐标
   */
  private _drawBackgroundColor(
    ctx2d: Context2d,
    element: IElement,
    startX: number,
    startY: number
  ): void {
    const { scale } = this.options
    const trList = element.trList || []
    for (let t = 0; t < trList.length; t++) {
      const tr = trList[t]
      const tdList = tr.tdList || []
      for (let d = 0; d < tdList.length; d++) {
        const td = tdList[d]
        if (td.backgroundColor) {
          ctx2d.save()
          ctx2d.fillStyle = td.backgroundColor
          ctx2d.fillRect(
            (td.x || 0) * scale + startX,
            (td.y || 0) * scale + startY,
            (td.width || 0) * scale,
            (td.height || 0) * scale
          )
          ctx2d.restore()
        }
      }
    }
  }

  /**
   * 绘制表格边框
   *
   * 遍历所有单元格，绘制单元格边框。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 表格元素
   * @param startX 起始 X 坐标
   * @param startY 起始 Y 坐标
   */
  private _drawBorder(
    ctx2d: Context2d,
    element: IElement,
    startX: number,
    startY: number
  ): void {
    const { scale } = this.options
    const trList = element.trList || []
    const borderWidth = (element.borderWidth || 1) * scale
    const borderColor = element.borderColor || '#000000'
    if (!trList.length) return

    ctx2d.save()
    ctx2d.strokeStyle = borderColor
    ctx2d.lineWidth = borderWidth
    ctx2d.translate(0.5, 0.5)

    for (let t = 0; t < trList.length; t++) {
      const tr = trList[t]
      const tdList = tr.tdList || []
      for (let d = 0; d < tdList.length; d++) {
        const td = tdList[d]
        const x = (td.x || 0) * scale + startX
        const y = (td.y || 0) * scale + startY
        const w = (td.width || 0) * scale
        const h = (td.height || 0) * scale
        ctx2d.strokeRect(x, y, w, h)
      }
    }
    ctx2d.restore()
  }

  /**
   * 获取按列分组的行列表
   *
   * 用于表格分页时计算跨行单元格的分布。
   *
   * @param trList 原始行列表
   * @returns 按列分组后的行列表
   */
  public getTrListGroupByCol(trList: ITr[]): ITr[] {
    const clonedTrList = deepClone(trList)
    for (let t = 0; t < trList.length; t++) {
      const tr = clonedTrList[t]
      for (let d = (tr.tdList || []).length - 1; d >= 0; d--) {
        const td = tr.tdList![d]
        const { rowspan, rowIndex, colIndex } = td
        const curRowIndex = (rowIndex || 0) + rowspan - 1
        if (curRowIndex !== d) {
          const changeTd = tr.tdList!.splice(d, 1)[0]
          clonedTrList[curRowIndex]?.tdList?.splice(colIndex || 0, 0, changeTd)
        }
      }
    }
    return clonedTrList
  }

  /**
   * 获取表格总宽度
   *
   * @param element 表格元素
   * @returns 表格总宽度
   */
  public getTableWidth(element: IElement): number {
    return (element.colgroup || []).reduce(
      (pre, cur) => pre + (cur.width || 0),
      0
    )
  }

  /**
   * 获取表格总高度
   *
   * @param element 表格元素
   * @returns 表格总高度
   */
  public getTableHeight(element: IElement): number {
    const trList = element.trList
    if (!trList?.length) return 0
    let height = 0
    for (let i = 0; i < trList.length; i++) {
      height += trList[i].height || 0
    }
    return height
  }
}

/**
 * 列表粒子渲染器
 *
 * 负责列表项编号和符号的计算与渲染，支持有序列表和无序列表。
 */
export class ListParticle {
  /** 列表缩进宽度 */
  public LIST_INDENT_WIDTH = 30

  /** 列表符号与文本之间的间距 */
  public LIST_GAP = 10

  /** 无序列表符号宽度 */
  private readonly UN_COUNT_STYLE_WIDTH = 20

  /** 测量基数文本 */
  private readonly MEASURE_BASE_TEXT = '0'

  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建列表粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 计算列表符号宽度映射
   *
   * 根据列表项内容计算每个列表组的符号宽度，用于预留空间。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param elementList 元素列表
   * @returns 列表 ID 到符号宽度的映射
   */
  public computeListStyle(
    ctx2d: Context2d,
    elementList: IElement[]
  ): Map<string, number> {
    const listStyleMap = new Map<string, number>()
    let start = 0
    if (!elementList[start]) return listStyleMap
    let curListId = elementList[start].listId
    let curElementList: IElement[] = []
    const elementLength = elementList.length
    while (start < elementLength) {
      const curElement = elementList[start]
      if (curListId && curListId === curElement.listId) {
        curElementList.push(curElement)
      } else {
        if (curElement.listId && curElement.listId !== curListId) {
          if (curElementList.length) {
            const width = this.getListStyleWidth(ctx2d, curElementList)
            listStyleMap.set(curListId!, width)
          }
          curListId = curElement.listId
          curListId = curElement.listId
          curElementList = curListId ? [curElement] : []
        }
      }
      start++
    }
    if (curElementList.length) {
      const width = this.getListStyleWidth(ctx2d, curElementList)
      listStyleMap.set(curListId!, width)
    }
    return listStyleMap
  }

  /**
   * 查找具有样式的元素
   *
   * 在元素列表中查找第一个具有字体、字号、加粗或斜体样式的元素。
   *
   * @param elementList 元素列表
   * @returns 具有样式的元素
   */
  private findStyledElement(elementList: IElement[]): IElement {
    let styleElement = elementList[0]
    for (let i = 1; i < elementList.length; i++) {
      const element = elementList[i]
      if (element.font || element.size || element.bold || element.italic) {
        styleElement = element
        break
      }
    }
    return styleElement
  }

  /**
   * 获取列表符号字体样式
   *
   * 根据配置决定是否继承上级文本样式。
   *
   * @param elementList 元素列表
   * @param scale 缩放系数
   * @returns CSS font 字符串
   */
  private getListFontStyle(elementList: IElement[], scale: number): string {
    const options = (this as any).draw?.getOptions?.() || {}
    if (options.list?.inheritStyle) {
      const styleElement = this.findStyledElement(elementList)
      return (
        (this as any).draw?.getFont?.(styleElement, scale) ||
        `${(options.defaultSize || 16) * scale}px ${options.defaultFont || 'Microsoft YaHei'}`
      )
    } else {
      return `${(options.defaultSize || 16) * scale}px ${options.defaultFont || 'Microsoft YaHei'}`
    }
  }

  /**
   * 获取列表符号宽度
   *
   * 根据列表类型（有序/无序）和样式计算符号占用的宽度。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param listElementList 列表元素列表
   * @returns 列表符号宽度
   */
  public getListStyleWidth(
    ctx2d: Context2d,
    listElementList: IElement[]
  ): number {
    const options = (this as any).draw?.getOptions?.() || {}
    const { scale, checkbox } = options
    const startElement = listElementList[0]
    if (
      startElement.listStyle &&
      startElement.listStyle !== ListStyle.DECIMAL
    ) {
      if (startElement.listStyle === ListStyle.CHECKBOX) {
        return (checkbox.width + this.LIST_GAP) * scale
      }
      return this.UN_COUNT_STYLE_WIDTH * scale
    }
    const count = listElementList.reduce((pre, cur) => {
      if (cur.value === ZERO) {
        pre += 1
      }
      return pre
    }, 0)
    if (!count) return 0
    ctx2d.save()
    ctx2d.font = this.getListFontStyle(listElementList, scale)
    const text = `${this.MEASURE_BASE_TEXT.repeat(String(count).length - 1 || 1)}${KeyMap.PERIOD}`
    const textMetrics = ctx2d.measureText(text)
    ctx2d.restore()
    const width =
      typeof textMetrics === 'number'
        ? textMetrics
        : (textMetrics as TextMetrics).width
    return Math.ceil((width + this.LIST_GAP) * scale)
  }

  /**
   * 绘制列表符号
   *
   * 根据列表类型绘制有序编号或无序符号。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param row 当前行信息
   * @param position 位置信息
   */
  public drawListStyle(
    ctx2d: Context2d,
    row: IRow,
    position: IElementPosition
  ): void {
    const { elementList, offsetX, listIndex } = row
    const startElement = elementList[0]
    if (!startElement || startElement.value !== ZERO || startElement.listWrap)
      return
    const { defaultTabWidth, scale } = this.draw.getOptions()
    let tabWidth = 0
    for (let i = 1; i < elementList.length; i++) {
      const element = elementList[i]
      if (element?.type !== ElementType.TAB) break
      tabWidth += defaultTabWidth * scale
    }
    const {
      coordinate: { leftTop },
      ascent
    } = position
    const [startX, startY] = leftTop as [number, number]
    const indentWidth = startElement.listLevel
      ? this.LIST_INDENT_WIDTH * startElement.listLevel * scale
      : 0
    const x = startX - (offsetX || 0) + indentWidth + tabWidth
    const y = startY + ascent

    ctx2d.save()
    ctx2d.font = this.getListFontStyle(elementList, scale)
    if (startElement.listType === ListType.OL) {
      ctx2d.fillText(`${listIndex! + 1}.`, x, y)
    } else {
      const level = startElement.listLevel ?? 0
      const rotation = [UlStyle.DISC, UlStyle.CIRCLE, UlStyle.SQUARE]
      const rotated = rotation[level % rotation.length]
      const fallbackStyle =
        level === 0
          ? <UlStyle>(<unknown>startElement.listStyle) || UlStyle.DISC
          : rotated
      const text = ulStyleMapping[fallbackStyle] || ulStyleMapping[UlStyle.DISC]
      if (text) {
        ctx2d.fillText(text, x, y)
      }
    }
    ctx2d.restore()
  }
}

/**
 * 换行符粒子渲染器
 *
 * 负责绘制换行符标记（↵），用于编辑器模式下显示换行位置。
 */
export class LineBreakParticle {
  /** 换行符标记宽度 */
  public static WIDTH = 12

  /** 换行符标记高度 */
  public static HEIGHT = 9

  /** 换行符标记间距 */
  public static GAP = 3

  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建换行符粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 渲染换行符标记
   *
   * 绘制一个箭头形状的标记，表示换行位置。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param element 元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx2d: Context2d,
    element: IRowElement,
    x: number,
    y: number
  ): void {
    const {
      scale,
      lineBreak: { color, lineWidth }
    } = this.draw.getOptions()
    ctx2d.save()
    ctx2d.beginPath()
    const top = y - (LineBreakParticle.HEIGHT * scale) / 2
    const left = x + element.metrics.width
    ctx2d.translate(left, top)
    ctx2d.scale(scale, scale)
    ctx2d.strokeStyle = color
    ctx2d.lineWidth = lineWidth
    ctx2d.lineCap = 'round'
    ctx2d.lineJoin = 'round'
    ctx2d.beginPath()
    ctx2d.moveTo(8, 0)
    ctx2d.lineTo(12, 0)
    ctx2d.lineTo(12, 6)
    ctx2d.lineTo(3, 6)
    ctx2d.moveTo(3, 6)
    ctx2d.lineTo(6, 3)
    ctx2d.moveTo(3, 6)
    ctx2d.lineTo(6, 9)
    ctx2d.stroke()
    ctx2d.closePath()
    ctx2d.restore()
  }
}

/**
 * 块元素粒子渲染器
 *
 * PDF 路径下不绘制（DOM 专属）。
 */
export class BlockParticle {
  /**
   * 渲染块元素（空实现）
   *
   * BLOCK 元素是 DOM 编辑器专属，PDF 中不需要绘制。
   */
  public render(): void {
    /* BlockParticle 在 PDF 路径下不绘制（DOM 专属） */
  }
}

/**
 * 标签粒子渲染器
 *
 * 负责标签元素的渲染，支持自定义背景色、文字颜色和圆角。
 */
export class LabelParticle {
  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /**
   * 创建标签粒子实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.options = draw.getOptions()
    this.draw = draw
  }

  /**
   * 渲染标签元素
   *
   * 绘制一个带圆角背景的标签，包含文本内容。
   *
   * @param ctx Canvas 2D 上下文
   * @param element 标签元素
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   */
  public render(
    ctx: Context2d,
    element: IRowElement,
    x: number,
    y: number
  ): void {
    const {
      scale,
      label: {
        defaultBackgroundColor,
        defaultColor,
        defaultBorderRadius,
        defaultPadding
      }
    } = this.options

    const backgroundColor =
      element.label?.backgroundColor || defaultBackgroundColor
    const color = element.label?.color || defaultColor
    const borderRadius = element.label?.borderRadius || defaultBorderRadius
    const padding = element.label?.padding || defaultPadding

    ctx.save()
    ctx.font = element.style.toLowerCase()
    const curStyle = element.style.toLowerCase()
    const fontWeight = element.bold ? 'bold' : 'normal'
    const fontItalic = element.italic ? 'italic' : ''
    this.draw.getPdf().setFont(curStyle.split('px ')[1], fontItalic, fontWeight)
    const { width, height, boundingBoxAscent } = element.metrics

    ctx.fillStyle = backgroundColor
    this._drawRoundedRect(
      ctx,
      x,
      y - boundingBoxAscent,
      width,
      height + (padding[0] + padding[3]) * scale,
      borderRadius * scale
    )
    ctx.fill()

    ctx.fillStyle = color
    ctx.fillText(element.value, x + padding[3] * scale, y)
    ctx.restore()
  }

  /**
   * 绘制圆角矩形
   *
   * 使用二次贝塞尔曲线绘制带圆角的矩形。
   *
   * @param ctx Canvas 2D 上下文
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   * @param width 宽度
   * @param height 高度
   * @param radius 圆角半径
   */
  private _drawRoundedRect(
    ctx: Context2d,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    ctx.lineTo(x + radius, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
  }
}
