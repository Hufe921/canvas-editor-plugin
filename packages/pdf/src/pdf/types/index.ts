/**
 * canvas-editor-pdf 类型定义模块
 *
 * 本模块包含所有枚举、接口和类型别名定义，
 * 从 canvas-editor 源码复制，保持与源码一致。
 */

/**
 * 字体来源类型
 */
export type FontSource = 'cdn' | 'bundled' | { dir: string }

/**
 * PDF 导出选项
 */
export type PdfOptions = {
  loadDefaultFonts?: boolean
  fontSource?: FontSource
}

/**
 * 编辑器模式枚举
 */
export enum EditorMode {
  PRINT = 'print'
}

/**
 * 编辑器区域枚举
 */
export enum EditorZone {
  HEADER = 'header',
  MAIN = 'main',
  FOOTER = 'footer'
}

/**
 * 页面模式枚举
 */
export enum PageMode {
  PAGING = 'paging',
  CONTINUITY = 'continuity'
}

/**
 * 纸张方向枚举
 */
export enum PaperDirection {
  VERTICAL = 'vertical',
  HORIZONTAL = 'horizontal'
}

/**
 * 换行策略枚举
 */
export enum WordBreak {
  BREAK_ALL = 'break-all',
  BREAK_WORD = 'break-word'
}

/**
 * 渲染模式枚举
 */
export enum RenderMode {
  SPEED = 'speed',
  COMPATIBILITY = 'compatibility'
}

/**
 * 元素类型枚举
 */
export enum ElementType {
  TEXT = 'text',
  IMAGE = 'image',
  TABLE = 'table',
  HYPERLINK = 'hyperlink',
  SUPERSCRIPT = 'superscript',
  SUBSCRIPT = 'subscript',
  SEPARATOR = 'separator',
  PAGE_BREAK = 'pageBreak',
  CONTROL = 'control',
  AREA = 'area',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  LATEX = 'latex',
  TAB = 'tab',
  DATE = 'date',
  BLOCK = 'block',
  TITLE = 'title',
  LIST = 'list',
  LABEL = 'label'
}

/**
 * 行对齐方式枚举
 */
export enum RowFlex {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
  ALIGNMENT = 'alignment',
  JUSTIFY = 'justify'
}

/**
 * 控件组件类型枚举
 */
export enum ControlComponent {
  PREFIX = 'prefix',
  POSTFIX = 'postfix',
  PRE_TEXT = 'preText',
  POST_TEXT = 'postText',
  PLACEHOLDER = 'placeholder',
  VALUE = 'value',
  CHECKBOX = 'checkbox',
  RADIO = 'radio'
}

/**
 * 控件缩进类型枚举
 */
export enum ControlIndentation {
  ROW_START = 'rowStart',
  VALUE_START = 'valueStart'
}

/**
 * 控件类型枚举
 */
export enum ControlType {
  TEXT = 'text',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  DATE = 'date',
  NUMBER = 'number'
}

/**
 * 图片显示模式枚举
 */
export enum ImageDisplay {
  INLINE = 'inline',
  BLOCK = 'block',
  SURROUND = 'surround',
  FLOAT_TOP = 'float-top',
  FLOAT_BOTTOM = 'float-bottom'
}

/**
 * 水印类型枚举
 */
export enum WatermarkType {
  TEXT = 'text',
  IMAGE = 'image'
}

/**
 * 水印层级枚举
 */
export enum WatermarkLayer {
  BOTTOM = 'bottom',
  TOP = 'top'
}

/**
 * 列表类型枚举
 */
export enum ListType {
  UL = 'ul',
  OL = 'ol'
}

/**
 * 无序列表样式枚举
 */
export enum UlStyle {
  DISC = 'disc',
  CIRCLE = 'circle',
  SQUARE = 'square',
  CHECKBOX = 'checkbox'
}

/**
 * 有序列表样式枚举
 */
export enum OlStyle {
  DECIMAL = 'decimal'
}

/**
 * 列表样式枚举（合并 UL 和 OL 样式）
 */
export enum ListStyle {
  DISC = UlStyle.DISC,
  CIRCLE = UlStyle.CIRCLE,
  SQUARE = UlStyle.SQUARE,
  DECIMAL = OlStyle.DECIMAL,
  CHECKBOX = UlStyle.CHECKBOX
}

/**
 * 键盘映射枚举
 */
export enum KeyMap {
  PERIOD = '.'
}

/**
 * 标题级别枚举
 */
export enum TitleLevel {
  ONE = 'one',
  TWO = 'two',
  THREE = 'three',
  FOUR = 'four',
  FIVE = 'five',
  SIX = 'six'
}

/**
 * 表格边框类型枚举
 */
export enum TableBorder {
  ALL = 'all',
  EXTERNAL = 'external'
}

/**
 * 单元格边框类型枚举
 */
export enum TdBorder {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left'
}

/**
 * 垂直对齐方式枚举
 */
export enum VerticalAlign {
  TOP = 'top',
  MIDDLE = 'middle',
  BOTTOM = 'bottom'
}

/**
 * 背景重复模式枚举
 */
export enum BackgroundRepeat {
  NO_REPEAT = 'no-repeat',
  REPEAT = 'repeat',
  REPEAT_X = 'repeat-x',
  REPEAT_Y = 'repeat-y'
}

/**
 * 背景尺寸模式枚举
 */
export enum BackgroundSize {
  CONTAIN = 'contain',
  COVER = 'cover'
}

/**
 * 数字类型枚举
 */
export enum NumberType {
  ARABIC = 'arabic',
  CHINESE = 'chinese'
}

/**
 * 行号样式枚举
 */
export enum LineNumberStyle {
  NONE = 'none',
  ARABIC = 'arabic',
  ROMAN = 'roman'
}

/**
 * 控件样式属性列表
 */
export const CONTROL_STYLE_ATTR: Array<keyof IControlStyle> = [
  'font',
  'size',
  'bold',
  'highlight',
  'italic'
]

/**
 * 编辑器行属性列表
 */
export const EDITOR_ROW_ATTR: Array<keyof IElement> = ['rowFlex', 'rowMargin']

/**
 * 编辑器元素上下文属性列表
 */
export const EDITOR_ELEMENT_CONTEXT_ATTR: Array<keyof IElement> = [
  'tdId',
  'trId',
  'tableId',
  'level',
  'titleId',
  'listId',
  'listLevel',
  'listType',
  'listStyle',
  'listWrap',
  'areaId',
  'areaIndex',
  'area',
  'controlId',
  'controlComponent',
  'control',
  'checkbox',
  'radio',
  'hyperlinkId',
  'url',
  'dateId',
  'dateFormat',
  'labelId',
  'label',
  'isControlMinWidthPlaceholder',
  'underline',
  'strikeout'
]

/**
 * 内边距类型定义 [top, right, bottom, left]
 */
export type IPadding = [
  top: number,
  right: number,
  bottom: number,
  left: number
]

/**
 * 外边距类型定义 [top, right, bottom, left]
 */
export type IMargin = [top: number, right: number, bottom: number, left: number]

/**
 * 原始类型联合
 */
export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null

/**
 * 内置类型联合
 */
export type Builtin = Primitive | Function | Date | Error | RegExp

/**
 * 深度必需类型递归
 */
export type DeepRequired<T> = T extends Error
  ? Required<T>
  : T extends Builtin
    ? T
    : T extends Map<infer K, infer V>
      ? Map<DeepRequired<K>, DeepRequired<V>>
      : T extends ReadonlyMap<infer K, infer V>
        ? ReadonlyMap<DeepRequired<K>, DeepRequired<V>>
        : T extends WeakMap<infer K, infer V>
          ? WeakMap<DeepRequired<K>, DeepRequired<V>>
          : T extends Set<infer U>
            ? Set<DeepRequired<U>>
            : T extends ReadonlySet<infer U>
              ? ReadonlySet<DeepRequired<U>>
              : T extends WeakSet<infer U>
                ? WeakSet<DeepRequired<U>>
                : T extends Promise<infer U>
                  ? Promise<DeepRequired<U>>
                  : T extends {}
                    ? { [K in keyof T]-?: DeepRequired<T[K]> }
                    : Required<T>

/**
 * 元素度量信息接口
 */
export interface IElementMetrics {
  width: number
  height: number
  boundingBoxAscent: number
  boundingBoxDescent: number
}

/**
 * 元素位置信息接口
 */
export interface IElementPosition {
  pageNo: number
  index: number
  value: string
  rowIndex: number
  rowNo: number
  ascent: number
  lineHeight: number
  left: number
  metrics: IElementMetrics
  isFirstLetter: boolean
  isLastLetter: boolean
  columnIndex?: number
  coordinate: {
    leftTop: number[]
    leftBottom: number[]
    rightTop: number[]
    rightBottom: number[]
  }
}

/**
 * 元素填充矩形接口
 */
export interface IElementFillRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 元素基础信息接口
 */
export interface IElementBasic {
  id?: string
  type?: ElementType
  value: string
  extension?: unknown
  externalId?: string
}

/**
 * 文本装饰接口
 */
export interface ITextDecoration {
  style?: string
}

/**
 * 元素样式接口
 */
export interface IElementStyle {
  font?: string
  size?: number
  width?: number
  height?: number
  bold?: boolean
  color?: string
  highlight?: string
  italic?: boolean
  underline?: boolean
  strikeout?: boolean
  rowFlex?: RowFlex
  rowMargin?: number
  letterSpacing?: number
  textDecoration?: ITextDecoration
}

/**
 * 元素规则接口
 */
export interface IElementRule {
  hide?: boolean
}

/**
 * 元素分组接口
 */
export interface IElementGroup {
  groupIds?: string[]
}

/**
 * 标题接口
 */
export interface ITitle {
  disabled?: boolean
}

/**
 * 标题元素接口
 */
export interface ITitleElement {
  valueList?: IElement[]
  level?: TitleLevel
  titleId?: string
  title?: ITitle
}

/**
 * 列表元素接口
 */
export interface IListElement {
  valueList?: IElement[]
  listType?: ListType
  listStyle?: ListStyle
  listId?: string
  listWrap?: boolean
  listLevel?: number
}

/**
 * 表格列定义接口
 */
export interface IColgroup {
  width?: number
}

/**
 * 表格行接口
 */
export interface ITr {
  id?: string
  height?: number
  minHeight?: number
  tdList?: ITd[]
  pagingRepeat?: boolean
}

/**
 * 表格单元格接口
 */
export interface ITd {
  conceptId?: string
  id?: string
  extension?: unknown
  externalId?: string
  x?: number
  y?: number
  width?: number
  height?: number
  colspan: number
  rowspan: number
  value: IElement[]
  trIndex?: number
  tdIndex?: number
  isLastRowTd?: boolean
  isLastColTd?: boolean
  isLastTd?: boolean
  rowIndex?: number
  colIndex?: number
  rowList?: IRow[]
  positionList?: IElementPosition[]
  verticalAlign?: VerticalAlign
  backgroundColor?: string
  borderTypes?: TdBorder[]
  slashTypes?: unknown[]
  mainHeight?: number
  realHeight?: number
  realMinHeight?: number
  disabled?: boolean
  deletable?: boolean
}

/**
 * 表格属性接口
 */
export interface ITableAttr {
  colgroup?: IColgroup[]
  trList?: ITr[]
  borderType?: TableBorder
  borderColor?: string
  borderWidth?: number
  borderExternalWidth?: number
  translateX?: number
}

/**
 * 表格规则接口
 */
export interface ITableRule {
  tableToolDisabled?: boolean
}

/**
 * 表格元素接口
 */
export interface ITableElement {
  tdId?: string
  trId?: string
  tableId?: string
  conceptId?: string
  pagingId?: string
  pagingIndex?: number
}

/**
 * 超链接元素接口
 */
export interface IHyperlinkElement {
  valueList?: IElement[]
  url?: string
  hyperlinkId?: string
}

/**
 * 上下标接口
 */
export interface ISuperscriptSubscript {
  actualSize?: number
}

/**
 * 分隔线接口
 */
export interface ISeparator {
  dashArray?: number[]
  lineWidth?: number
}

/**
 * 控件样式接口
 */
export interface IControlStyle {
  font?: string
  size?: number
  bold?: boolean
  highlight?: string
  italic?: boolean
}

/**
 * 控件接口
 */
export interface IControl extends IControlStyle {
  prefix?: string
  postfix?: string
  value?: IElement[]
  placeholder?: string
  code?: string
  type?: ControlType
  valueSets?: unknown[]
  minWidth?: number
  border?: boolean
  underline?: boolean
  bracketColor?: string
  placeholderColor?: string
  indentation?: ControlIndentation
  deletable?: boolean
  disabled?: boolean
  pasteDisabled?: boolean
  hide?: boolean
}

/**
 * 控件元素接口
 */
export interface IControlElement {
  control?: IControl
  controlId?: string
  controlComponent?: ControlComponent
  isControlMinWidthPlaceholder?: boolean
}

/**
 * 复选框接口
 */
export interface ICheckbox {
  code?: string
  value?: boolean
}

/**
 * 复选框元素接口
 */
export interface ICheckboxElement {
  checkbox?: ICheckbox
}

/**
 * 单选框接口
 */
export interface IRadio {
  code?: string
  value?: boolean
}

/**
 * 单选框元素接口
 */
export interface IRadioElement {
  radio?: IRadio
}

/**
 * LaTeX 元素接口
 */
export interface ILaTexElement {
  laTexSVG?: string
}

/**
 * 日期元素接口
 */
export interface IDateElement {
  dateFormat?: string
  dateId?: string
}

/**
 * 图片裁剪接口
 */
export interface IImageCrop {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 图片标题接口
 */
export interface IImageCaption {
  value: string
  color?: string
  font?: string
  size?: number
  top?: number
}

/**
 * 图片标题选项接口
 */
export interface IImgCaptionOption {
  color?: string
  font?: string
  size?: number
  top?: number
}

/**
 * 列表选项接口
 */
export interface IListOption {
  inheritStyle?: boolean
}

/**
 * 图片基础接口
 */
export interface IImageBasic {
  imgDisplay?: ImageDisplay
  imgFloatPosition?: {
    x: number
    y: number
    pageNo?: number
  }
  imgCrop?: IImageCrop
  imgCaption?: IImageCaption
}

/**
 * 图片规则接口
 */
export interface IImageRule {
  imgToolDisabled?: boolean
  imgPreviewDisabled?: boolean
}

/**
 * 块元素接口
 */
export interface IBlockElement {
  block?: unknown
}

/**
 * 区域接口
 */
export interface IArea {
  top?: number
  hide?: boolean
}

/**
 * 区域元素接口
 */
export interface IAreaElement {
  valueList?: IElement[]
  areaId?: string
  areaIndex?: number
  area?: IArea
}

/**
 * 标签元素接口
 */
export interface ILabelElement {
  labelId?: string
  label?: {
    color?: string
    backgroundColor?: string
    borderRadius?: number
    padding?: IPadding
  }
}

/**
 * 元素类型联合
 */
export type IElement = IElementBasic &
  IElementStyle &
  IElementRule &
  IElementGroup &
  ITableAttr &
  ITableRule &
  ITableElement &
  IHyperlinkElement &
  ISuperscriptSubscript &
  ISeparator &
  IControlElement &
  ICheckboxElement &
  IRadioElement &
  ILaTexElement &
  IDateElement &
  IImageBasic &
  IImageRule &
  IBlockElement &
  ITitleElement &
  IListElement &
  IAreaElement &
  ILabelElement

/**
 * 行元素接口（扩展自 IElement）
 */
export interface IRowElement extends IElement {
  metrics: IElementMetrics
  style: string
  left?: number
}

/**
 * 行接口
 */
export interface IRow {
  width: number
  height: number
  ascent: number
  rowFlex?: RowFlex
  startIndex: number
  isPageBreak?: boolean
  isList?: boolean
  listIndex?: number
  offsetX?: number
  offsetY?: number
  elementList: IRowElement[]
  isWidthNotEnough?: boolean
  rowIndex: number
  isSurround?: boolean
  columnIndex?: number
}

/**
 * 分栏选项接口
 */
export interface IColumnOption {
  count: number
  gap?: number
  separator?: boolean
  separatorColor?: string
  separatorWidth?: number
}

/**
 * 分栏布局接口
 */
export interface IColumnLayout {
  count: number
  width: number
  gap: number
  separator: boolean
  separatorColor?: string
  separatorWidth?: number
  offsets: number[]
}

/**
 * 背景选项接口
 */
export interface IBackgroundOption {
  image?: string
  color?: string
  size?: BackgroundSize
  repeat?: BackgroundRepeat
  applyPageNumbers?: number[]
}

/**
 * 复选框选项接口
 */
export interface ICheckboxOption {
  width?: number
  height?: number
  gap?: number
  lineWidth?: number
  fillStyle?: string
  strokeStyle?: string
  checkFillStyle?: string
  checkStrokeStyle?: string
  checkMarkColor?: string
  verticalAlign?: VerticalAlign
}

/**
 * 单选框选项接口
 */
export interface IRadioOption {
  width?: number
  height?: number
  gap?: number
  lineWidth?: number
  fillStyle?: string
  strokeStyle?: string
  checkFillStyle?: string
  checkMarkColor?: string
  verticalAlign?: VerticalAlign
}

/**
 * 控件选项接口
 */
export interface IControlOption {
  prefix?: string
  postfix?: string
  bracketColor?: string
  placeholderColor?: string
  activeBackgroundColor?: string
  borderWidth?: number
  borderColor?: string
  disabledBackgroundColor?: string
  existValueBackgroundColor?: string
  noValueBackgroundColor?: string
}

/**
 * 光标选项接口
 */
export interface ICursorOption {
  width?: number
  color?: string
  dragWidth?: number
  dragColor?: string
  dragFloatImageDisabled?: boolean
}

/**
 * 页脚选项接口
 */
export interface IFooter {
  disabled?: boolean
  disabledPages?: number[]
  bottom?: number
  maxHeightRadio?: string
  inactiveAlpha?: number
  editable?: boolean
}

/**
 * 分组选项接口
 */
export interface IGroup {
  disabled?: boolean
}

/**
 * 页眉选项接口
 */
export interface IHeader {
  disabled?: boolean
  disabledPages?: number[]
  top?: number
  maxHeightRadio?: string
  inactiveAlpha?: number
  editable?: boolean
}

/**
 * 标签选项接口
 */
export interface ILabelOption {
  defaultColor?: string
  defaultBackgroundColor?: string
  defaultBorderRadius?: number
  defaultPadding?: IPadding
}

/**
 * 换行符选项接口
 */
export interface ILineBreakOption {
  disabled?: boolean
  color?: string
  lineWidth?: number
}

/**
 * 分页选项接口
 */
export interface IPageBreak {
  font?: string
  fontSize?: number
  lineDash?: number[]
}

/**
 * 页码选项接口
 */
export interface IPageNumber {
  disabled?: boolean
  bottom?: number
  size?: number
  font?: string
  color?: string
  rowFlex?: RowFlex | string
  format?: string
  numberType?: NumberType | string
  startPageNo?: number
  fromPageNo?: number
  maxPageNo?: number | null
}

/**
 * 占位符选项接口
 */
export interface IPlaceholder {
  data?: string
  value?: string
  color?: string
  opacity?: number
  size?: number
  font?: string
}

/**
 * 标题选项接口
 */
export interface ITitleOption {
  one?: number
  two?: number
  three?: number
  four?: number
  five?: number
  six?: number
}

/**
 * 水印选项接口
 */
export interface IWatermark {
  disabled?: boolean
  data?: string
  type?: WatermarkType | string
  layer?: WatermarkLayer | string
  color?: string
  size?: number
  font?: string
  opacity?: number
  repeat?: boolean
  gap?: [number, number]
  numberType?: NumberType | string
  width?: number
  height?: number
}

/**
 * 区域选项接口
 */
export interface IZoneOption {}

/**
 * 分隔线选项接口
 */
export interface ISeparatorOption {
  lineWidth?: number
  strokeStyle?: string
}

/**
 * 表格选项接口
 */
export interface ITableOption {
  tdPadding?: IPadding
  defaultTrMinHeight?: number
  defaultColMinWidth?: number
  defaultBorderColor?: string
  overflow?: boolean
}

/**
 * 行号选项接口
 */
export interface ILineNumberOption {
  disabled?: boolean
  style?: LineNumberStyle
  size?: number
  font?: string
  color?: string
  right?: number
  type?: string
}

/**
 * 页面边框选项接口
 */
export interface IPageBorderOption {
  disabled?: boolean
  color?: string
  lineWidth?: number
  padding?: IPadding
}

/**
 * 徽章选项接口
 */
export interface IBadgeOption {
  top?: number
  left?: number
}

/**
 * 涂鸦选项接口
 */
export interface IGraffitiOption {
  defaultLineColor?: string
  defaultLineWidth?: number
}

/**
 * 模式规则接口
 */
export interface IModeRule {
  backgroundDisabled?: boolean
}

/**
 * 涂鸦数据接口
 */
export interface IGraffitiData {
  id?: string
  width?: number
  height?: number
  data?: string
}

/**
 * 编辑器数据接口
 */
export interface IEditorData {
  header?: IElement[]
  main: IElement[]
  footer?: IElement[]
  graffiti?: IGraffitiData[]
}

/**
 * 编辑器选项接口
 */
export interface IEditorOption {
  mode?: EditorMode | string
  locale?: string
  defaultType?: string
  defaultColor?: string
  defaultFont?: string
  defaultSize?: number
  fontSource?: FontSource
  minSize?: number
  maxSize?: number
  defaultBasicRowMarginHeight?: number
  defaultRowMargin?: number
  defaultTabWidth?: number
  width?: number
  height?: number
  scale?: number
  pageGap?: number
  underlineColor?: string
  strikeoutColor?: string
  rangeColor?: string
  rangeAlpha?: number
  rangeMinWidth?: number
  searchMatchColor?: string
  searchNavigateMatchColor?: string
  searchMatchAlpha?: number
  highlightAlpha?: number
  highlightMarginHeight?: number
  resizerColor?: string
  resizerSize?: number
  marginIndicatorSize?: number
  marginIndicatorColor?: string
  margins?: IMargin
  pageMode?: PageMode | string
  renderMode?: RenderMode | string
  defaultHyperlinkColor?: string
  paperDirection?: PaperDirection | string
  inactiveAlpha?: number
  historyMaxRecordCount?: number
  printPixelRatio?: number
  maskMargin?: IMargin
  letterClass?: string[]
  contextMenuDisableKeys?: string[]
  shortcutDisableKeys?: string[]
  scrollContainerSelector?: string
  pageOuterSelectionDisable?: boolean
  wordBreak?: WordBreak | string
  table?: ITableOption
  header?: IHeader
  footer?: IFooter
  pageNumber?: IPageNumber
  watermark?: IWatermark
  control?: IControlOption
  checkbox?: ICheckboxOption
  radio?: IRadioOption
  cursor?: ICursorOption
  title?: ITitleOption
  placeholder?: IPlaceholder
  group?: IGroup
  pageBreak?: IPageBreak
  zone?: IZoneOption
  background?: IBackgroundOption
  lineBreak?: ILineBreakOption
  separator?: ISeparatorOption
  lineNumber?: ILineNumberOption
  pageBorder?: IPageBorderOption
  badge?: IBadgeOption
  modeRule?: IModeRule
  graffiti?: IGraffitiOption
  label?: ILabelOption
  imgCaption?: IImgCaptionOption
  list?: IListOption
  column?: IColumnOption
}

/**
 * 绘制行参数接口
 */
export interface IDrawRowPayload {
  elementList: IElement[]
  rowList: IRow[]
  pageNo: number
  positionList: IElementPosition[]
  startIndex?: number
  innerWidth?: number
  zone?: EditorZone
  isDrawLineBreak?: boolean
  isDrawWhiteSpace?: boolean
}

/**
 * 绘制页面参数接口
 */
export interface IDrawPagePayload {
  rowList: IRow[]
  pageNo: number
}

/**
 * 计算行列表参数接口
 */
export interface IComputeRowListPayload {
  innerWidth: number
  elementList: IElement[]
  startX?: number
  startY?: number
  isFromTable?: boolean
  isPagingMode?: boolean
  pageHeight?: number
  surroundElementList?: IElement[]
}

/**
 * 计算页面行位置参数接口
 */
export interface IComputePageRowPositionPayload {
  positionList: IElementPosition[]
  rowList: IRow[]
  pageNo: number
  startX: number
  startY: number
  startRowIndex: number
  startIndex: number
  innerWidth: number
  zone?: EditorZone
  isTable?: boolean
  index?: number
  tdIndex?: number
  trIndex?: number
  tablePosition?: IElementPosition
}

/**
 * 计算行位置参数接口
 */
export interface IComputeRowPositionPayload {
  row: IRow
  innerWidth: number
}

/**
 * 设置环绕位置参数接口
 */
export interface ISetSurroundPositionPayload {
  row: IRow
  rowElement: IRowElement
  rowElementRect: IElementFillRect
  pageNo: number
  availableWidth: number
  surroundElementList: IElement[]
}

/**
 * DrawPdf 类接口定义（用于装饰器等依赖注入）
 */
export interface IDrawPdfLike {
  getWidth(): number
  getHeight(): number
  getOptions(): DeepRequired<IEditorOption>
  getInnerWidth(): number
  getMainHeight(): number
  getMainOuterHeight(pageNo?: number): number
  getMargins(): IMargin
  getElementSize(el: IElement): number
  getHighlightMarginHeight(): number
  getCtx2d(): unknown
  getPageCount(): number
  getPdf(): {
    setGState: (gstate: unknown) => void
    setFont: (font: string, style: string, variant: string) => void
    setCharSpace: (space: number) => void
  }
  getPosition(): {
    getOriginalMainPositionList: () => unknown[]
    setSurroundPosition: (payload: ISetSurroundPositionPayload) => { x: number; rowIncreaseWidth: number }
  }
  getPageRowList(): IRow[][]
  measureText(font: string, text: string): TextMetrics
  getFont(el: IElement, scale?: number): string
  getHeader(): { getExtraHeight: (pageNo?: number) => number; getPositionList?: () => unknown[] }
  getFooter(): { getExtraHeight: (pageNo?: number) => number; getPositionList?: () => unknown[] }
  drawRow(ctx2d: unknown, payload: IDrawRowPayload): void
}

/**
 * 零值常量（零宽字符）
 *
 * 用于占位和行首光标定位，值为零宽字符 \u200B
 */
export const ZERO = '\u200B'

/**
 * 行首换行符正则表达式
 */
export const START_LINE_BREAK_REG = /^[\r\n]+/

/**
 * 文本类元素类型集合
 */
export const TEXTLIKE_ELEMENT_TYPE: ElementType[] = [
  ElementType.TEXT,
  ElementType.HYPERLINK,
  ElementType.SUPERSCRIPT,
  ElementType.SUBSCRIPT,
  ElementType.CONTROL,
  ElementType.DATE
]

/**
 * 块级元素类型集合
 */
export const BLOCK_ELEMENT_TYPE: ElementType[] = [
  ElementType.IMAGE,
  ElementType.TABLE,
  ElementType.SEPARATOR,
  ElementType.PAGE_BREAK,
  ElementType.BLOCK,
  ElementType.TITLE
]

/**
 * 浮动位置接口
 */
export interface IFloatPosition {
  pageNo: number
  element: IElement
  position: IElementPosition
  isTable?: boolean
  index?: number
  tdIndex?: number
  trIndex?: number
  tdValueIndex?: number
  zone?: EditorZone
}
