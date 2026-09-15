/**
 * canvas-editor-pdf 页眉页脚模块
 *
 * 本模块包含页眉和页脚的实现，负责页眉页脚内容的计算和渲染。
 */

import type { Context2d } from 'jspdf'
import type {
  IDrawPdfLike,
  IElement,
  IRow,
  IElementPosition,
  DeepRequired,
  IEditorOption
} from '../types'
import { EditorZone } from '../types'
import { Position } from '../position/index'
import { pickSurroundElementList } from '../utils'

/**
 * 页眉接口
 *
 * 定义页眉组件必须实现的方法。
 */
export interface IHeaderLike {
  /**
   * 获取页眉额外高度
   *
   * @param pageNo 页码（可选）
   * @returns 额外高度（像素）
   */
  getExtraHeight(pageNo?: number): number

  /**
   * 获取页眉高度
   *
   * @param pageNo 页码（可选）
   * @returns 页眉高度（像素）
   */
  getHeight(pageNo?: number): number

  /**
   * 获取页眉顶部位置
   *
   * @param pageNo 页码（可选）
   * @returns 页眉顶部 Y 坐标（像素）
   */
  getHeaderTop(pageNo?: number): number

  /**
   * 获取元素位置列表
   *
   * @returns 元素位置列表
   */
  getPositionList(): IElementPosition[]

  /**
   * 判断页眉是否在指定页面禁用
   *
   * @param pageNo 页码（可选）
   * @returns 是否禁用
   */
  isDisabled(pageNo?: number): boolean

  /**
   * 渲染页眉
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  render(ctx2d: Context2d, pageNo: number): void
}

/**
 * 页脚接口
 *
 * 定义页脚组件必须实现的方法。
 */
export interface IFooterLike {
  /**
   * 获取页脚额外高度
   *
   * @param pageNo 页码（可选）
   * @returns 额外高度（像素）
   */
  getExtraHeight(pageNo?: number): number

  /**
   * 获取页脚高度
   *
   * @param pageNo 页码（可选）
   * @returns 页脚高度（像素）
   */
  getHeight(pageNo?: number): number

  /**
   * 获取页脚底部位置
   *
   * @param pageNo 页码（可选）
   * @returns 页脚底部 Y 坐标（像素）
   */
  getFooterBottom(pageNo?: number): number

  /**
   * 获取元素位置列表
   *
   * @returns 元素位置列表
   */
  getPositionList(): IElementPosition[]

  /**
   * 判断页脚是否在指定页面禁用
   *
   * @param pageNo 页码（可选）
   * @returns 是否禁用
   */
  isDisabled(pageNo?: number): boolean

  /**
   * 渲染页脚
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  render(ctx2d: Context2d, pageNo: number): void
}

/**
 * 页眉组件
 *
 * 负责页眉内容的计算和渲染，支持自定义内容和分页控制。
 */
export class Header implements IHeaderLike {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /** 页眉元素列表 */
  private elementList: IElement[]

  /** 页眉行列表 */
  private rowList: IRow[] = []

  /** 元素位置列表 */
  private positionList: IElementPosition[] = []

  /**
   * 创建页眉实例
   *
   * @param draw DrawPdf 实例引用
   * @param data 页眉元素列表（可选）
   */
  constructor(draw: IDrawPdfLike, data?: IElement[]) {
    this.draw = draw
    this.options = draw.getOptions()
    this.elementList = data || []
  }

  /**
   * 获取元素位置列表
   *
   * @returns 元素位置列表
   */
  public getPositionList(): IElementPosition[] {
    return this.positionList
  }

  /**
   * 获取页眉顶部位置
   *
   * @param pageNo 页码（可选）
   * @returns 页眉顶部 Y 坐标（像素）
   */
  public getHeaderTop(pageNo?: number): number {
    if (this.isDisabled(pageNo)) return 0
    return Math.floor(this.options.header.top * this.options.scale)
  }

  /**
   * 获取页眉最大高度
   *
   * 根据配置的比例（half/one-third/quarter）计算最大高度。
   *
   * @returns 最大高度（像素）
   */
  public getMaxHeight(): number {
    const radio = this.options.header.maxHeightRadio as
      | 'half'
      | 'one-third'
      | 'quarter'
    const mapping: Record<string, number> = {
      half: 1 / 2,
      'one-third': 1 / 3,
      quarter: 1 / 4
    }
    return Math.floor(this.draw.getHeight() * (mapping[radio] || 0.5))
  }

  /**
   * 获取页眉行总高度
   *
   * @returns 行总高度（像素）
   */
  public getRowHeight(): number {
    return this.rowList.reduce((p, c) => p + c.height, 0)
  }

  /**
   * 获取页眉高度
   *
   * 返回实际行高度和最大高度中的较小值。
   *
   * @param pageNo 页码（可选）
   * @returns 页眉高度（像素）
   */
  public getHeight(pageNo?: number): number {
    if (this.isDisabled(pageNo)) return 0
    if (!this.elementList.length) return 0
    const rowHeight = this.getRowHeight()
    const maxHeight = this.getMaxHeight()
    return rowHeight > maxHeight ? maxHeight : rowHeight
  }

  /**
   * 获取页眉额外高度
   *
   * 计算页眉超出页边距的部分高度。
   *
   * @param pageNo 页码（可选）
   * @returns 额外高度（像素）
   */
  public getExtraHeight(pageNo?: number): number {
    const margins = this.draw.getMargins()
    const headerHeight = this.getHeight(pageNo)
    const headerTop = this.getHeaderTop(pageNo)
    const extraHeight = headerTop + headerHeight - margins[0]
    return extraHeight <= 0 ? 0 : extraHeight
  }

  /**
   * 判断页眉是否在指定页面禁用
   *
   * @param pageNo 页码（可选）
   * @returns 是否禁用
   */
  public isDisabled(pageNo?: number): boolean {
    if (this.options.header.disabled) return true
    if (
      pageNo !== undefined &&
      this.options.header.disabledPages.includes(pageNo)
    ) {
      return true
    }
    return false
  }

  /**
   * 计算页眉布局
   *
   * 依次调用行列表计算和位置列表计算。
   */
  public compute(): void {
    this.recovery()
    this._computeRowList()
    this._computePositionList()
  }

  /**
   * 恢复状态
   *
   * 清空行列表和位置列表。
   */
  public recovery(): void {
    this.rowList = []
    this.positionList = []
  }

  /**
   * 计算行列表
   *
   * 根据元素列表计算页眉的行布局。
   */
  private _computeRowList(): void {
    if (this.isDisabled() || !this.elementList.length) {
      return
    }
    const innerWidth = this.draw.getInnerWidth()
    const margins = this.draw.getMargins()
    const surroundElementList = pickSurroundElementList(this.elementList)
    this.rowList = (this.draw as unknown as {
      computeRowList(payload: {
        innerWidth: number
        elementList: IElement[]
        startX: number
        startY: number
        surroundElementList: IElement[]
      }): IRow[]
    }).computeRowList({
      innerWidth,
      elementList: this.elementList,
      startX: margins[3],
      startY: this.getHeaderTop(),
      surroundElementList
    })
  }

  /**
   * 计算位置列表
   *
   * 根据行列表计算每个元素的位置信息。
   */
  private _computePositionList(): void {
    if (this.isDisabled() || !this.elementList.length) {
      return
    }
    const headerTop = this.getHeaderTop()
    const innerWidth = this.draw.getInnerWidth()
    const margins = this.draw.getMargins()
    const startX = margins[3]
    const startY = headerTop
    const position = new Position(this.draw)
    position.computePageRowPosition({
      positionList: this.positionList,
      rowList: this.rowList,
      pageNo: 0,
      startRowIndex: 0,
      startIndex: 0,
      startX,
      startY,
      innerWidth,
      zone: EditorZone.HEADER
    })
  }

  /**
   * 渲染页眉
   *
   * 在指定页面绘制页眉内容。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  public render(ctx2d: Context2d, pageNo: number): void {
    if (this.options.header.disabledPages.includes(pageNo)) return
    ctx2d.globalAlpha = 1
    const innerWidth = this.draw.getInnerWidth()
    const maxHeight = this.getMaxHeight()
    const rowList: IRow[] = []
    let curRowHeight = 0
    for (let r = 0; r < this.rowList.length; r++) {
      const row = this.rowList[r]
      if (curRowHeight + row.height > maxHeight) {
        break
      }
      rowList.push(row)
      curRowHeight += row.height
    }
    this.draw.drawRow(ctx2d, {
      elementList: this.elementList,
      positionList: ((this.draw.getHeader() as { getPositionList?: () => IElementPosition[] }).getPositionList?.() || []) as IElementPosition[],
      rowList,
      pageNo,
      startIndex: 0,
      innerWidth,
      zone: EditorZone.HEADER
    })
  }
}

/**
 * 页脚组件
 *
 * 负责页脚内容的计算和渲染，支持自定义内容和分页控制。
 */
export class Footer implements IFooterLike {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /** 页脚元素列表 */
  private elementList: IElement[]

  /** 页脚行列表 */
  private rowList: IRow[] = []

  /** 元素位置列表 */
  private positionList: IElementPosition[] = []

  /**
   * 创建页脚实例
   *
   * @param draw DrawPdf 实例引用
   * @param data 页脚元素列表（可选）
   */
  constructor(draw: IDrawPdfLike, data?: IElement[]) {
    this.draw = draw
    this.options = draw.getOptions()
    this.elementList = data || []
  }

  /**
   * 获取元素位置列表
   *
   * @returns 元素位置列表
   */
  public getPositionList(): IElementPosition[] {
    return this.positionList
  }

  /**
   * 获取页脚底部位置
   *
   * @param pageNo 页码（可选）
   * @returns 页脚底部 Y 坐标（像素）
   */
  public getFooterBottom(pageNo?: number): number {
    if (this.isDisabled(pageNo)) return 0
    return Math.floor(this.options.footer.bottom * this.options.scale)
  }

  /**
   * 获取页脚最大高度
   *
   * 根据配置的比例（half/one-third/quarter）计算最大高度。
   *
   * @returns 最大高度（像素）
   */
  public getMaxHeight(): number {
    const radio = this.options.footer.maxHeightRadio as
      | 'half'
      | 'one-third'
      | 'quarter'
    const mapping: Record<string, number> = {
      half: 1 / 2,
      'one-third': 1 / 3,
      quarter: 1 / 4
    }
    return Math.floor(this.draw.getHeight() * (mapping[radio] || 0.5))
  }

  /**
   * 获取页脚行总高度
   *
   * @returns 行总高度（像素）
   */
  public getRowHeight(): number {
    return this.rowList.reduce((p, c) => p + c.height, 0)
  }

  /**
   * 获取页脚高度
   *
   * 返回实际行高度和最大高度中的较小值。
   *
   * @param pageNo 页码（可选）
   * @returns 页脚高度（像素）
   */
  public getHeight(pageNo?: number): number {
    if (this.isDisabled(pageNo)) return 0
    if (!this.elementList.length) return 0
    const rowHeight = this.getRowHeight()
    const maxHeight = this.getMaxHeight()
    return rowHeight > maxHeight ? maxHeight : rowHeight
  }

  /**
   * 获取页脚额外高度
   *
   * 计算页脚超出页边距的部分高度。
   *
   * @param pageNo 页码（可选）
   * @returns 额外高度（像素）
   */
  public getExtraHeight(pageNo?: number): number {
    const margins = this.draw.getMargins()
    const footerHeight = this.getHeight(pageNo)
    const footerBottom = this.getFooterBottom(pageNo)
    const extraHeight = footerBottom + footerHeight - margins[2]
    return extraHeight <= 0 ? 0 : extraHeight
  }

  /**
   * 判断页脚是否在指定页面禁用
   *
   * @param pageNo 页码（可选）
   * @returns 是否禁用
   */
  public isDisabled(pageNo?: number): boolean {
    if (this.options.footer.disabled) return true
    if (
      pageNo !== undefined &&
      this.options.footer.disabledPages.includes(pageNo)
    ) {
      return true
    }
    return false
  }

  /**
   * 计算页脚布局
   *
   * 依次调用行列表计算和位置列表计算。
   */
  public compute(): void {
    this.recovery()
    this._computeRowList()
    this._computePositionList()
  }

  /**
   * 恢复状态
   *
   * 清空行列表和位置列表。
   */
  public recovery(): void {
    this.rowList = []
    this.positionList = []
  }

  /**
   * 计算行列表
   *
   * 根据元素列表计算页脚的行布局。
   */
  private _computeRowList(): void {
    const innerWidth = this.draw.getInnerWidth()
    this.rowList = (this.draw as unknown as {
      computeRowList(payload: {
        innerWidth: number
        elementList: IElement[]
      }): IRow[]
    }).computeRowList({
      innerWidth,
      elementList: this.elementList
    })
  }

  /**
   * 计算位置列表
   *
   * 根据行列表计算每个元素的位置信息。
   */
  private _computePositionList(): void {
    const footerBottom = this.getFooterBottom()
    const innerWidth = this.draw.getInnerWidth()
    const margins = this.draw.getMargins()
    const startX = margins[3]
    const pageHeight = this.draw.getHeight()
    const footerHeight = this.getHeight()
    const startY = pageHeight - footerBottom - footerHeight
    const position = new Position(this.draw)
    position.computePageRowPosition({
      positionList: this.positionList,
      rowList: this.rowList,
      pageNo: 0,
      startRowIndex: 0,
      startIndex: 0,
      startX,
      startY,
      innerWidth,
      zone: EditorZone.FOOTER
    })
  }

  /**
   * 渲染页脚
   *
   * 在指定页面绘制页脚内容。
   *
   * @param ctx2d Canvas 2D 上下文
   * @param pageNo 当前页码
   */
  public render(ctx2d: Context2d, pageNo: number): void {
    if (this.options.footer.disabledPages.includes(pageNo)) return
    ctx2d.globalAlpha = 1
    const innerWidth = this.draw.getInnerWidth()
    const maxHeight = this.getMaxHeight()
    const rowList: IRow[] = []
    let curRowHeight = 0
    for (let r = 0; r < this.rowList.length; r++) {
      const row = this.rowList[r]
      if (curRowHeight + row.height > maxHeight) {
        break
      }
      rowList.push(row)
      curRowHeight += row.height
    }
    this.draw.drawRow(ctx2d, {
      elementList: this.elementList,
      positionList: this.positionList,
      rowList,
      pageNo,
      startIndex: 0,
      innerWidth,
      zone: EditorZone.FOOTER
    })
  }
}