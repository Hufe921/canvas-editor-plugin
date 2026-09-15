/**
 * canvas-editor-pdf 位置计算模块
 *
 * 本模块负责计算元素在页面上的精确位置，处理分页、分栏、表格单元格等复杂布局场景。
 */

import type {
  IDrawPdfLike,
  IElementPosition,
  IFloatPosition,
  DeepRequired,
  IEditorOption,
  IComputePageRowPositionPayload,
  IComputeRowPositionPayload,
  ISetSurroundPositionPayload,
  IColumnLayout
} from '../types'
import { EditorZone, ElementType, ImageDisplay, VerticalAlign } from '../types'
import { deepClone, isRectIntersect } from '../utils'

/**
 * 位置计算器
 *
 * 负责计算元素的精确坐标位置，处理分页、分栏、环绕布局等复杂场景。
 */
export class Position {
  /** DrawPdf 实例引用 */
  private draw: IDrawPdfLike

  /** 编辑器选项 */
  private options: DeepRequired<IEditorOption>

  /** 元素位置列表 */
  private positionList: IElementPosition[] = []

  /** 浮动元素位置列表 */
  private floatPositionList: IFloatPosition[] = []

  /**
   * 创建位置计算器实例
   *
   * @param draw DrawPdf 实例引用
   */
  constructor(draw: IDrawPdfLike) {
    this.draw = draw
    this.options = draw.getOptions()
  }

  /**
   * 获取原始主内容位置列表
   *
   * @returns 元素位置列表
   */
  public getOriginalMainPositionList(): IElementPosition[] {
    return this.positionList
  }

  /**
   * 获取浮动元素位置列表
   *
   * @returns 浮动元素位置列表
   */
  public getFloatPositionList(): IFloatPosition[] {
    return this.floatPositionList
  }

  /**
   * 设置浮动元素位置列表
   *
   * @param list 浮动元素位置列表
   */
  public setFloatPositionList(list: IFloatPosition[]): void {
    this.floatPositionList = list
  }

  /**
   * 计算所有元素的位置列表
   *
   * 遍历所有页面和行，计算每个元素的精确坐标。
   */
  public computePositionList(): void {
    this.positionList = []
    const innerWidth = this.draw.getInnerWidth()
    const pageRowList = this.draw.getPageRowList()
    const margins = this.draw.getMargins()
    const startX = margins[3]
    const header = this.draw.getHeader()
    let startRowIndex = 0
    for (let i = 0; i < pageRowList.length; i++) {
      const rowList = pageRowList[i]
      if (!rowList?.length) continue
      const startIndex = rowList[0].startIndex
      const startY = margins[0] + header.getExtraHeight(i)
      this.computePageRowPosition({
        positionList: this.positionList,
        rowList,
        pageNo: i,
        startRowIndex,
        startIndex,
        startX,
        startY,
        innerWidth
      })
      startRowIndex += rowList.length
    }
  }

  /**
   * 计算指定页面行的元素位置
   *
   * 这是核心位置计算方法，处理分栏、对齐、表格单元格等复杂布局。
   *
   * @param payload 计算参数
   */
  public computePageRowPosition(payload: IComputePageRowPositionPayload): void {
    const {
      positionList,
      rowList,
      pageNo,
      startX,
      startY,
      startRowIndex,
      startIndex,
      innerWidth,
      zone = EditorZone.MAIN,
      tablePosition
    } = payload
    const { scale, table } = this.options
    const columnManager = (
      this.draw as unknown as { columnManager: { getLayout(): IColumnLayout | null } }
    ).columnManager
    const columnLayout = columnManager?.getLayout() || null

    let x = startX
    let y = startY
    let curIndex = startIndex
    let prevColumnIndex: number | undefined = undefined

    for (let i = 0; i < rowList.length; i++) {
      const curRow = rowList[i]
      if (
        prevColumnIndex !== undefined &&
        curRow.columnIndex !== undefined &&
        curRow.columnIndex > 0 &&
        curRow.columnIndex !== prevColumnIndex
      ) {
        y = startY
      }
      prevColumnIndex = curRow.columnIndex

      const inColumn =
        columnLayout &&
        curRow.columnIndex !== undefined &&
        curRow.columnIndex >= 0
      const columnOffset =
        inColumn && columnLayout
          ? columnLayout.offsets[curRow.columnIndex!] || 0
          : 0
      const effectiveInnerWidth =
        inColumn && columnLayout ? columnLayout.width : innerWidth
      x += columnOffset

      if (!curRow.isSurround) {
        const curRowWidth = curRow.width + (curRow.offsetX || 0)
        if (curRow.rowFlex === 'center') {
          x += (effectiveInnerWidth - curRowWidth) / 2
        } else if (curRow.rowFlex === 'right') {
          x += effectiveInnerWidth - curRowWidth
        }
      }

      x += curRow.offsetX || 0
      y += curRow.offsetY || 0

      const tablePreX = x
      const tablePreY = y
      for (let j = 0; j < curRow.elementList.length; j++) {
        const element = curRow.elementList[j]
        const metrics = element.metrics
        const offsetY =
          !element.hide &&
          ((element.imgDisplay !== ImageDisplay.INLINE &&
            element.type === ElementType.IMAGE) ||
            element.type === ElementType.LATEX)
            ? curRow.ascent - metrics.height
            : curRow.ascent

        if (element.left) {
          x += element.left
        }

        if (element.translateX) {
          x += element.translateX * scale
        }

        const positionItem: IElementPosition = {
          pageNo,
          index: curIndex,
          value: element.value,
          rowIndex: startRowIndex + i,
          rowNo: i,
          metrics,
          left: element.left || 0,
          ascent: offsetY,
          lineHeight: curRow.height,
          isFirstLetter: j === 0,
          isLastLetter: j === curRow.elementList.length - 1,
          columnIndex: curRow.columnIndex,
          coordinate: {
            leftTop: [x, y],
            leftBottom: [x, y + curRow.height],
            rightTop: [x + metrics.width, y],
            rightBottom: [x + metrics.width, y + curRow.height]
          }
        }

        if (
          element.imgDisplay === ImageDisplay.SURROUND ||
          element.imgDisplay === ImageDisplay.FLOAT_TOP ||
          element.imgDisplay === ImageDisplay.FLOAT_BOTTOM
        ) {
          const prePosition = positionList[positionList.length - 1]
          if (prePosition) {
            positionItem.metrics = prePosition.metrics
            positionItem.coordinate = prePosition.coordinate
          }
          if (!element.imgFloatPosition) {
            const tableLeftTop = tablePosition?.coordinate.leftTop
            element.imgFloatPosition = {
              x: tableLeftTop ? x - tableLeftTop[0] : x,
              y: tableLeftTop ? y - tableLeftTop[1] : y,
              pageNo
            }
          }
          this.floatPositionList.push({
            pageNo,
            element,
            position: positionItem,
            isTable: payload.isTable,
            index: payload.index,
            tdIndex: payload.tdIndex,
            trIndex: payload.trIndex,
            tdValueIndex: curIndex,
            zone
          })
        }

        positionList.push(positionItem)
        curIndex++
        x += metrics.width

        if (element.type === ElementType.TABLE && !element.hide) {
          const tdPaddingWidth = table.tdPadding[1] + table.tdPadding[3]
          const tdPaddingHeight = table.tdPadding[0] + table.tdPadding[2]
          for (let t = 0; t < (element.trList || []).length; t++) {
            const tr = element.trList![t]
            for (let d = 0; d < (tr.tdList || []).length; d++) {
              const td = tr.tdList![d]
              td.positionList = []
              const rowList = td.rowList!
              this.computePageRowPosition({
                positionList: td.positionList,
                rowList,
                pageNo,
                startX:
                  (td.x! + table.tdPadding[3]) * scale +
                  tablePreX +
                  (element.translateX || 0) * scale,
                startY: (td.y! + table.tdPadding[0]) * scale + tablePreY,
                startRowIndex: 0,
                startIndex: 0,
                innerWidth: (td.width! - tdPaddingWidth) * scale,
                zone,
                isTable: true,
                index: curIndex - 1,
                tdIndex: d,
                trIndex: t,
                tablePosition: positionItem
              })
              if (
                td.verticalAlign === VerticalAlign.MIDDLE ||
                td.verticalAlign === VerticalAlign.BOTTOM
              ) {
                const rowsHeight = rowList.reduce(
                  (pre, cur) => pre + cur.height,
                  0
                )
                const blankHeight =
                  (td.height! - tdPaddingHeight) * scale - rowsHeight
                const offsetHeight =
                  td.verticalAlign === VerticalAlign.MIDDLE
                    ? blankHeight / 2
                    : blankHeight
                if (Math.floor(offsetHeight) > 0) {
                  td.positionList.forEach(tdPosition => {
                    const {
                      coordinate: { leftTop, leftBottom, rightBottom, rightTop }
                    } = tdPosition
                    leftTop[1] += offsetHeight
                    leftBottom[1] += offsetHeight
                    rightBottom[1] += offsetHeight
                    rightTop[1] += offsetHeight
                  })
                }
              }
            }
          }
        }
      }

      x = startX
      y += curRow.height
    }
  }

  /**
   * 计算单行的元素位置
   *
   * @param payload 计算参数
   * @returns 元素位置列表
   */
  public computeRowPosition(
    payload: IComputeRowPositionPayload
  ): IElementPosition[] {
    const { row, innerWidth } = payload
    const positionList: IElementPosition[] = []
    this.computePageRowPosition({
      positionList,
      innerWidth,
      rowList: [deepClone(row)],
      pageNo: 0,
      startX: 0,
      startY: 0,
      startIndex: 0,
      startRowIndex: 0
    })
    return positionList
  }

  /**
   * 设置环绕元素的位置
   *
   * 处理浮动元素与文本的环绕布局，计算文本需要偏移的距离。
   *
   * @param payload 环绕位置计算参数
   * @returns 偏移后的 X 坐标和行增加的宽度
   */
  public setSurroundPosition(payload: ISetSurroundPositionPayload): {
    x: number
    rowIncreaseWidth: number
  } {
    const { scale } = this.options
    const {
      pageNo,
      row,
      rowElement,
      rowElementRect,
      surroundElementList,
      availableWidth
    } = payload
    let x = rowElementRect.x
    let rowIncreaseWidth = 0
    if (
      surroundElementList.length &&
      !(rowElement.type &&
        ['block', 'pageBreak', 'separator', 'table'].includes(rowElement.type)) &&
      rowElement.imgDisplay !== 'inline' &&
      !rowElement.control?.minWidth
    ) {
      for (let s = 0; s < surroundElementList.length; s++) {
        const surroundElement = surroundElementList[s]
        const floatPosition = surroundElement.imgFloatPosition!
        if (floatPosition?.pageNo !== pageNo) continue
        const surroundRect = {
          ...floatPosition,
          x: (floatPosition.x || 0) * scale,
          y: (floatPosition.y || 0) * scale,
          width: (surroundElement.width || 0) * scale,
          height: (surroundElement.height || 0) * scale
        }
        if (isRectIntersect(rowElementRect, surroundRect)) {
          row.isSurround = true
          const translateX =
            surroundRect.width + surroundRect.x - rowElementRect.x
          rowElement.left = translateX
          row.width += translateX
          rowIncreaseWidth += translateX
          x = surroundRect.x + surroundRect.width
          if (row.width + rowElement.metrics.width > availableWidth) {
            rowElement.left = 0
            row.width -= rowIncreaseWidth
            break
          }
        }
      }
    }
    return { x, rowIncreaseWidth }
  }
}