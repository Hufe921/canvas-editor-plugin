/**
 * canvas-editor-pdf 富文本装饰器模块
 *
 * 本模块包含文本装饰器的抽象基类和具体实现，
 * 用于实现高亮、下划线、删除线等富文本效果的绘制。
 */

import type { Context2d } from 'jspdf'
import { GState } from 'jspdf'
import type { IDrawPdfLike, IElementFillRect } from '../types'

/**
 * 富文本装饰器抽象基类
 *
 * 负责收集连续文本元素的填充区域信息（坐标、尺寸、颜色、装饰样式），
 * 当颜色或样式发生变化时自动触发渲染，实现跨元素的连续装饰线/高亮绘制。
 * 子类（Highlight / Underline / Strikeout）只需实现 `render()` 方法。
 */
export abstract class AbstractRichText {
  /** DrawPdf 实例引用 */
  protected draw: IDrawPdfLike

  /** Canvas 2D 上下文引用 */
  protected ctx2d?: Context2d

  /** 当前累积的填充区域信息 */
  protected fillRect: IElementFillRect = { x: 0, y: 0, width: 0, height: 0 }

  /** 当前填充颜色 */
  protected fillColor?: string

  /** 当前装饰样式 */
  protected fillDecorationStyle?: string

  /**
   * 创建装饰器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
  }

  /**
   * 清空当前填充区域信息
   */
  public clearFillInfo(): void {
    this.fillRect = { x: 0, y: 0, width: 0, height: 0 }
    this.fillColor = undefined
    this.fillDecorationStyle = undefined
  }

  /**
   * 记录填充区域信息
   *
   * 如果颜色或装饰样式发生变化，会先渲染之前累积的内容，然后重新开始记录。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param x 起始 X 坐标
   * @param y 起始 Y 坐标
   * @param width 宽度
   * @param height 高度（可选）
   * @param color 填充颜色（可选）
   * @param decorationStyle 装饰样式（可选）
   */
  public recordFillInfo(
    ctx2d: Context2d,
    x: number,
    y: number,
    width: number,
    height?: number,
    color?: string,
    decorationStyle?: string
  ): void {
    const isFirstRecord = !this.fillRect.width
    if (
      !isFirstRecord &&
      (this.fillColor !== color || this.fillDecorationStyle !== decorationStyle)
    ) {
      this.render(ctx2d)
      this.clearFillInfo()
      this.recordFillInfo(ctx2d, x, y, width, height, color, decorationStyle)
      return
    }
    if (isFirstRecord) {
      this.fillRect.x = x
      this.fillRect.y = y
    }
    if (height && this.fillRect.height < height) {
      this.fillRect.height = height
    }
    this.fillRect.width += width
    this.fillColor = color
    this.fillDecorationStyle = decorationStyle
  }

  /**
   * 渲染当前累积的装饰效果
   *
   * 子类必须实现此方法来绘制具体的装饰效果。
   *
   * @param ctx2d Canvas 2D 上下文
   */
  public abstract render(ctx2d: Context2d): void
}

/**
 * 高亮装饰器
 *
 * 实现文本高亮背景的绘制，支持透明度设置。
 */
export class Highlight extends AbstractRichText {
  /**
   * 渲染高亮效果
   *
   * 使用半透明填充矩形实现文本高亮，透明度由 `highlightAlpha` 控制。
   *
   * @param ctx2d Canvas 2D 上下文
   */
  public render(ctx2d: Context2d): void {
    if (!this.fillRect.width) return
    const { highlightAlpha } = this.draw.getOptions()
    const { x, y, width, height } = this.fillRect
    ctx2d.save()
    const pdf = this.draw.getPdf()
    pdf.setGState(new GState({ opacity: highlightAlpha }))
    ctx2d.globalAlpha = highlightAlpha
    ctx2d.fillStyle = this.fillColor!
    ctx2d.fillRect(x, y, width, height)
    pdf.setGState(new GState({ opacity: 1 }))
    ctx2d.restore()
    this.clearFillInfo()
  }
}

/**
 * 下划线装饰器
 *
 * 实现文本下划线的绘制，支持自定义颜色和线宽。
 */
export class Underline extends AbstractRichText {
  /**
   * 渲染下划线效果
   *
   * 在文本底部绘制一条横线，颜色优先使用元素自定义颜色，否则使用默认下划线颜色。
   *
   * @param ctx2d Canvas 2D 上下文
   */
  public render(ctx2d: Context2d): void {
    if (!this.fillRect.width) return
    const { scale, underlineColor } = this.draw.getOptions()
    const { x, y, width } = this.fillRect
    ctx2d.save()
    ctx2d.strokeStyle = this.fillColor || underlineColor
    ctx2d.lineWidth = scale
    const adjustY = Math.floor(y + 2 * scale) + 0.5
    ctx2d.beginPath()
    ctx2d.moveTo(x, adjustY)
    ctx2d.lineTo(x + width, adjustY)
    ctx2d.stroke()
    ctx2d.restore()
    this.clearFillInfo()
  }
}

/**
 * 删除线装饰器
 *
 * 实现文本删除线的绘制，支持自定义颜色和线宽。
 */
export class Strikeout extends AbstractRichText {
  /**
   * 渲染删除线效果
   *
   * 在文本中间绘制一条横线，表示删除线效果。
   *
   * @param ctx2d Canvas 2D 上下文
   */
  public render(ctx2d: Context2d): void {
    if (!this.fillRect.width) return
    const { scale, strikeoutColor } = this.draw.getOptions()
    const { x, y, width } = this.fillRect
    ctx2d.save()
    ctx2d.lineWidth = scale
    ctx2d.strokeStyle = strikeoutColor
    const adjustY = y + 0.5
    ctx2d.beginPath()
    ctx2d.moveTo(x, adjustY)
    ctx2d.lineTo(x + width, adjustY)
    ctx2d.stroke()
    ctx2d.restore()
    this.clearFillInfo()
  }
}