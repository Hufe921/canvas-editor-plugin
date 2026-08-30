/**
 * canvas-editor-pdf 选项配置模块
 *
 * 本模块包含默认选项定义、选项合并函数和元素格式化函数，
 * 与 canvas-editor 源码 utils/option.ts 和 utils/element.ts 保持一致。
 */

import type {
  IEditorOption,
  IElement,
  DeepRequired,
  IBackgroundOption,
  ICheckboxOption,
  IRadioOption,
  IControlOption,
  IFooter,
  IGroup,
  IHeader,
  ILabelOption,
  IImgCaptionOption,
  ILineBreakOption,
  IPageNumber,
  IPlaceholder,
  ISeparatorOption,
  ITableOption,
  ITitleOption,
  IWatermark,
  ILineNumberOption,
  IListOption,
  IColumnOption,
  IPageBorderOption,
  IBadgeOption,
  IModeRule,
  IGraffitiOption,
  ICursorOption,
  IPageBreak,
  IZoneOption
} from '../types'
import {
  ElementType,
  TitleLevel,
  ZERO,
  START_LINE_BREAK_REG,
  TEXTLIKE_ELEMENT_TYPE,
  BackgroundSize,
  BackgroundRepeat,
  LineNumberStyle,
  ControlComponent,
  ControlType,
  CONTROL_STYLE_ATTR,
  EDITOR_ELEMENT_CONTEXT_ATTR,
  EDITOR_ROW_ATTR,
  VerticalAlign
} from '../types'
import { getUUID, splitText, deepClone, pickObject } from '../utils'

/**
 * 默认背景选项
 */
const defaultBackground: IBackgroundOption = {
  image: '',
  color: '#ffffff',
  size: BackgroundSize.COVER,
  repeat: BackgroundRepeat.NO_REPEAT
}

/**
 * 默认复选框选项
 */
const defaultCheckboxOption: ICheckboxOption = {
  width: 16,
  height: 16,
  gap: 8,
  lineWidth: 1,
  fillStyle: '#4080ff',
  strokeStyle: '#ffffff',
  checkFillStyle: '#4080ff',
  checkMarkColor: '#ffffff',
  verticalAlign: VerticalAlign.MIDDLE
}

/**
 * 默认单选框选项
 */
const defaultRadioOption: IRadioOption = {
  width: 14,
  height: 14,
  gap: 8,
  lineWidth: 1,
  fillStyle: '#4080ff',
  strokeStyle: '#ffffff',
  checkFillStyle: '#4080ff',
  checkMarkColor: '#ffffff',
  verticalAlign: VerticalAlign.MIDDLE
}

/**
 * 默认控件选项
 */
const defaultControlOption: IControlOption = {
  prefix: '',
  postfix: '',
  bracketColor: '#000000',
  placeholderColor: '#CCCCCC'
}

/**
 * 默认页脚选项
 */
const defaultFooterOption: IFooter = {
  disabled: false,
  disabledPages: [],
  bottom: 50,
  maxHeightRadio: 'half'
}

/**
 * 默认分组选项
 */
const defaultGroupOption: IGroup = {
  disabled: false
}

/**
 * 默认页眉选项
 */
const defaultHeaderOption: IHeader = {
  disabled: false,
  disabledPages: [],
  top: 50,
  maxHeightRadio: 'half'
}

/**
 * 默认标签选项
 */
const defaultLabelOption: ILabelOption = {
  defaultColor: '#1976d2',
  defaultBackgroundColor: '#e3f2fd',
  defaultBorderRadius: 4,
  defaultPadding: [4, 4, 4, 4]
}

/**
 * 默认图片标题选项
 */
const defaultImgCaptionOption: IImgCaptionOption = {
  color: '#666666',
  font: 'Microsoft YaHei',
  size: 12,
  top: 8
}

/**
 * 默认换行符选项
 */
const defaultLineBreak: ILineBreakOption = {
  disabled: true,
  color: '#CCCCCC',
  lineWidth: 1.5
}

/**
 * 默认页码选项
 */
const defaultPageNumberOption: IPageNumber = {
  disabled: false,
  bottom: 20
}

/**
 * 默认占位符选项
 */
const defaultPlaceholderOption: IPlaceholder = {
  value: '',
  color: '#CCCCCC'
}

/**
 * 默认分隔线选项
 */
const defaultSeparatorOption: ISeparatorOption = {
  lineWidth: 1,
  strokeStyle: '#000000'
}

/**
 * 默认表格选项
 */
const defaultTableOption: ITableOption = {
  tdPadding: [8, 8, 8, 8],
  defaultTrMinHeight: 24,
  defaultColMinWidth: 50
}

/**
 * 默认标题选项
 */
const defaultTitleOption: ITitleOption = {
  one: 32,
  two: 24,
  three: 18,
  four: 16,
  five: 14,
  six: 12
}

/**
 * 默认水印选项
 */
const defaultWatermarkOption: IWatermark = {
  disabled: false,
  data: '',
  type: 'text',
  layer: 'bottom',
  width: 0,
  height: 0,
  color: '#AEB5C0',
  opacity: 0.3,
  size: 200,
  font: 'Microsoft YaHei',
  repeat: false,
  gap: [10, 10],
  numberType: 'arabic'
}

/**
 * 默认行号选项
 */
const defaultLineNumberOption: ILineNumberOption = {
  disabled: false,
  style: LineNumberStyle.NONE
}

/**
 * 默认列表选项
 */
const defaultListOption: IListOption = {
  inheritStyle: false
}

/**
 * 默认分栏选项
 */
const defaultColumnOption: IColumnOption = {
  count: 1,
  gap: 20,
  separator: false,
  separatorColor: '#CCCCCC',
  separatorWidth: 1
}

/**
 * 默认页面边框选项
 */
const defaultPageBorderOption: IPageBorderOption = {
  disabled: false,
  color: '#CCCCCC',
  lineWidth: 1
}

/**
 * 默认徽章选项
 */
const defaultBadgeOption: IBadgeOption = {}

/**
 * 默认模式规则选项
 */
const defaultModeRuleOption: IModeRule = {
  backgroundDisabled: false
}

/**
 * 默认涂鸦选项
 */
const defaultGraffitiOption: IGraffitiOption = {
  defaultLineColor: '#FF0000',
  defaultLineWidth: 3
}

/**
 * 格式化元素列表选项接口
 */
export interface IFormatElementListOption {
  isHandleFirstElement?: boolean
  isForceCompensation?: boolean
  editorOptions: DeepRequired<IEditorOption>
}

/**
 * 合并用户传入的 `IEditorOption` 与内置默认值
 *
 * 返回一个所有字段均已填充的 `DeepRequired<IEditorOption>`。
 * 逐项合并各子配置（table/header/footer/pageNumber/watermark/control/...），
 * 缺省字段自动回退到 `default*Option` 常量。
 *
 * @param options 用户传入的部分选项（可为空对象）
 * @returns 合并后的完整选项对象
 */
export function mergeOption(options: IEditorOption = {}): DeepRequired<IEditorOption> {
  const tableOptions = {
    ...defaultTableOption,
    ...options.table
  } as Required<ITableOption>
  const headerOptions = {
    ...defaultHeaderOption,
    ...options.header
  } as Required<IHeader>
  const footerOptions = {
    ...defaultFooterOption,
    ...options.footer
  } as Required<IFooter>
  const pageNumberOptions = {
    ...defaultPageNumberOption,
    ...options.pageNumber
  } as Required<IPageNumber>
  const waterMarkOptions = {
    ...defaultWatermarkOption,
    ...options.watermark
  } as Required<IWatermark>
  const controlOptions = {
    ...defaultControlOption,
    ...options.control
  } as Required<IControlOption>
  const checkboxOptions = {
    ...defaultCheckboxOption,
    ...options.checkbox
  } as Required<ICheckboxOption>
  const radioOptions = {
    ...defaultRadioOption,
    ...options.radio
  } as Required<IRadioOption>
  const cursorOptions = { ...options.cursor } as Required<ICursorOption>
  const titleOptions = {
    ...defaultTitleOption,
    ...options.title
  } as Required<ITitleOption>
  const placeholderOptions = {
    ...defaultPlaceholderOption,
    ...options.placeholder
  } as Required<IPlaceholder>
  const groupOptions = {
    ...defaultGroupOption,
    ...options.group
  } as Required<IGroup>
  const pageBreakOptions = { ...options.pageBreak } as Required<IPageBreak>
  const zoneOptions = { ...options.zone } as Required<IZoneOption>
  const backgroundOptions = {
    ...defaultBackground,
    ...options.background
  } as Required<IBackgroundOption>
  const lineBreakOptions = {
    ...defaultLineBreak,
    ...options.lineBreak
  } as Required<ILineBreakOption>
  const separatorOptions = {
    ...defaultSeparatorOption,
    ...options.separator
  } as Required<ISeparatorOption>
  const lineNumberOptions = {
    ...defaultLineNumberOption,
    ...options.lineNumber
  } as Required<ILineNumberOption>
  const pageBorderOptions = {
    ...defaultPageBorderOption,
    ...options.pageBorder
  } as Required<IPageBorderOption>
  const badgeOptions = {
    ...defaultBadgeOption,
    ...options.badge
  } as Required<IBadgeOption>
  const graffitiOptions = {
    ...defaultGraffitiOption,
    ...options.graffiti
  } as Required<IGraffitiOption>
  const labelOptions = {
    ...defaultLabelOption,
    ...options.label
  } as Required<ILabelOption>
  const imgCaptionOptions = {
    ...defaultImgCaptionOption,
    ...options.imgCaption
  } as Required<IImgCaptionOption>
  const listOptions = {
    ...defaultListOption,
    ...options.list
  } as Required<IListOption>
  const columnOptions = {
    ...defaultColumnOption,
    ...options.column
  } as Required<IColumnOption>
  const modeRuleOption = {
    ...defaultModeRuleOption,
    ...options.modeRule
  } as DeepRequired<IModeRule>

  return {
    mode: 'edit',
    locale: 'zhCN',
    defaultType: 'TEXT',
    defaultColor: '#000000',
    defaultFont: 'Microsoft YaHei',
    defaultSize: 16,
    minSize: 5,
    maxSize: 72,
    defaultRowMargin: 1,
    defaultBasicRowMarginHeight: 8,
    defaultTabWidth: 32,
    width: 794,
    height: 1123,
    scale: 1,
    pageGap: 20,
    underlineColor: '#000000',
    strikeoutColor: '#FF0000',
    rangeAlpha: 0.6,
    rangeColor: '#AECBFA',
    rangeMinWidth: 5,
    searchMatchAlpha: 0.6,
    searchMatchColor: '#FFFF00',
    searchNavigateMatchColor: '#AAD280',
    highlightAlpha: 0.6,
    highlightMarginHeight: 8,
    resizerColor: '#4182D9',
    resizerSize: 5,
    marginIndicatorSize: 35,
    marginIndicatorColor: '#BABABA',
    margins: [100, 120, 100, 120],
    pageMode: 'paging',
    renderMode: 'speed',
    defaultHyperlinkColor: '#0000FF',
    paperDirection: 'vertical',
    inactiveAlpha: 0.6,
    historyMaxRecordCount: 100,
    wordBreak: 'break-word',
    printPixelRatio: 3,
    maskMargin: [0, 0, 0, 0],
    letterClass: ['A-Za-z'],
    contextMenuDisableKeys: [],
    shortcutDisableKeys: [],
    scrollContainerSelector: '',
    pageOuterSelectionDisable: false,
    ...options,
    table: tableOptions,
    header: headerOptions,
    footer: footerOptions,
    pageNumber: pageNumberOptions,
    watermark: waterMarkOptions,
    control: controlOptions,
    checkbox: checkboxOptions,
    radio: radioOptions,
    cursor: cursorOptions,
    title: titleOptions,
    placeholder: placeholderOptions,
    group: groupOptions,
    pageBreak: pageBreakOptions,
    zone: zoneOptions,
    background: backgroundOptions,
    lineBreak: lineBreakOptions,
    separator: separatorOptions,
    lineNumber: lineNumberOptions,
    pageBorder: pageBorderOptions,
    badge: badgeOptions,
    modeRule: modeRuleOption,
    graffiti: graffitiOptions,
    label: labelOptions,
    imgCaption: imgCaptionOptions,
    list: listOptions,
    column: columnOptions
  } as DeepRequired<IEditorOption>
}

/**
 * 默认选项常量（空配置合并后的结果）
 */
export const defaultOption: DeepRequired<IEditorOption> = mergeOption({})

/**
 * 预格式化元素列表
 *
 * 补齐渲染所需的元信息：
 * - 在非文本/列表起始元素前插入 ZERO 占位，保证行首光标定位正确
 * - 逐元素计算 `metrics`（宽高、基线）、`style`（CSS font 字符串）、`actualSize`
 * - 处理上标/下标字号缩减、控件前缀/后缀拼接、列表项编号等
 * - 处理图片异步加载（通过 imageObserver 收集 Promise）
 *
 * 该函数会原地修改 elementList，是 render/compute 之前必须执行的预处理步骤。
 *
 * @param elementList 待格式化的元素列表（会被原地修改）
 * @param options 格式化选项（是否处理首元素、是否强制补偿、编辑器配置）
 */
export async function formatElementList(
  elementList: IElement[],
  options: IFormatElementListOption
): Promise<void> {
  const {
    isHandleFirstElement = true,
    isForceCompensation = false,
    editorOptions
  } = options
  const startElement = elementList[0]
  if (
    startElement?.type !== ElementType.LIST &&
    (isForceCompensation ||
      (isHandleFirstElement &&
        ((startElement?.type && startElement.type !== ElementType.TEXT) ||
          !START_LINE_BREAK_REG.test(startElement?.value))))
  ) {
    elementList.unshift({ value: ZERO })
  }
  let i = 0
  while (i < elementList.length) {
    let el = elementList[i]
    if (el.type === ElementType.TITLE) {
      elementList.splice(i, 1)
      const valueList = el.valueList || []
      await formatElementList(valueList, {
        ...options,
        isHandleFirstElement: false,
        isForceCompensation: false
      })
      if (valueList.length) {
        const titleId = getUUID()
        const titleOptions = editorOptions.title
        for (let v = 0; v < valueList.length; v++) {
          const value = valueList[v]
          value.title = el.title
          if (el.level) {
            value.titleId = titleId
            value.level = el.level
          }
          if (!value.size) {
            value.size =
              titleOptions[
                value.level === TitleLevel.ONE
                  ? 'one'
                  : value.level === TitleLevel.TWO
                    ? 'two'
                    : value.level === TitleLevel.THREE
                      ? 'three'
                      : value.level === TitleLevel.FOUR
                        ? 'four'
                        : value.level === TitleLevel.FIVE
                          ? 'five'
                          : 'six'
              ]
          }
          if (value.bold === undefined) {
            value.bold = true
          }
          elementList.splice(i, 0, value)
          i++
        }
      }
      i--
    } else if (el.type === ElementType.LIST) {
      elementList.splice(i, 1)
      const valueList = el.valueList || []
      await formatElementList(valueList, {
        ...options,
        isHandleFirstElement: true,
        isForceCompensation: false
      })
      if (valueList.length) {
        const fallbackListId = el.listId || getUUID()
        const listIdMap = new Map<number, string>([[0, fallbackListId]])
        for (let v = 0; v < valueList.length; v++) {
          const value = valueList[v]
          const listLevel = value.listLevel ?? el.listLevel ?? 0
          if (!value.listId) {
            value.listId = listIdMap.get(listLevel) || getUUID()
          }
          listIdMap.set(listLevel, value.listId)
          Array.from(listIdMap.keys()).forEach(level => {
            if (level > listLevel) {
              listIdMap.delete(level)
            }
          })
          value.listType = value.listType || el.listType
          value.listStyle = value.listStyle || el.listStyle
          value.listLevel = listLevel
          elementList.splice(i, 0, value)
          i++
        }
        if (
          elementList[i] &&
          !START_LINE_BREAK_REG.test(elementList[i].value)
        ) {
          elementList.splice(i, 0, { value: ZERO })
          i++
        }
      }
      i--
    } else if (el.type === ElementType.AREA) {
      elementList.splice(i, 1)
      const valueList = el?.valueList || []
      await formatElementList(valueList, {
        ...options,
        isHandleFirstElement: true,
        isForceCompensation: true
      })
      if (valueList.length) {
        const areaId = getUUID()
        for (let v = 0; v < valueList.length; v++) {
          const value = valueList[v]
          value.areaId = el.areaId || areaId
          value.area = el.area
          value.areaIndex = v
          elementList.splice(i, 0, value)
          i++
        }
      }
      i--
    } else if (el.type === ElementType.TABLE) {
      const tableId = getUUID()
      el.id = tableId
      if (el.trList) {
        const {
          table: { defaultTrMinHeight, defaultColMinWidth },
          margins
        } = editorOptions
        const safeMargins = margins || [0, 0, 0, 0]
        if (!el.colgroup?.length && el.trList.length) {
          const firstTr = el.trList[0]
          const tdList = firstTr.tdList || []
          const colCount = tdList.reduce((pre, cur) => pre + cur.colspan, 0)
          const innerWidth =
            editorOptions.width - safeMargins[1] - safeMargins[3]
          const colWidth = Math.max(innerWidth / colCount, defaultColMinWidth)
          el.colgroup = []
          for (let c = 0; c < colCount; c++) {
            el.colgroup.push({ width: colWidth })
          }
        }
        for (let t = 0; t < el.trList.length; t++) {
          const tr = el.trList[t]
          const trId = getUUID()
          tr.id = trId
          if (!tr.minHeight || tr.minHeight < defaultTrMinHeight) {
            tr.minHeight = defaultTrMinHeight
          }
          if ((tr.height || 0) < tr.minHeight) {
            tr.height = tr.minHeight
          }
          const tdList = tr.tdList || []
          for (let d = 0; d < tdList.length; d++) {
            const td = tdList[d]
            const tdId = getUUID()
            td.id = tdId
            await formatElementList(td.value, {
              ...options,
              isHandleFirstElement: true,
              isForceCompensation: true
            })
            for (let v = 0; v < td.value.length; v++) {
              const value = td.value[v]
              value.tdId = tdId
              value.trId = trId
              value.tableId = tableId
            }
          }
        }
      }
    } else if (el.type === ElementType.DATE) {
      elementList.splice(i, 1)
      const valueList = el.valueList || []
      const unzippedList: IElement[] = []
      for (let v = 0; v < valueList.length; v++) {
        const item = valueList[v]
        const texts = splitText(item.value)
        for (let d = 0; d < texts.length; d++) {
          unzippedList.push({ ...item, value: texts[d] })
        }
      }
      if (unzippedList.length) {
        const dateId = getUUID()
        for (let v = 0; v < unzippedList.length; v++) {
          const value = unzippedList[v]
          value.type = el.type
          value.dateFormat = el.dateFormat
          value.dateId = dateId
          elementList.splice(i, 0, value)
          i++
        }
      }
      i--
    } else if (el.type === ElementType.CONTROL) {
      if (!el.control) {
        i++
        continue
      }
      const { prefix, postfix, value, placeholder, code, type, valueSets } =
        el.control
      const {
        control: controlOption,
        checkbox: checkboxOption,
        radio: radioOption
      } = editorOptions
      const controlId = getUUID()
      elementList.splice(i, 1)
      const controlContext = pickObject(el, [
        ...(EDITOR_ELEMENT_CONTEXT_ATTR as Array<keyof IElement>),
        ...(EDITOR_ROW_ATTR as Array<keyof IElement>)
      ])
      const controlDefaultStyle = pickObject(
        el.control as unknown as IElement,
        CONTROL_STYLE_ATTR as Array<keyof IElement>
      )
      const thePrePostfixArg: Omit<IElement, 'value'> = {
        ...controlDefaultStyle,
        color: editorOptions.control.bracketColor
      }
      const prefixStrList = splitText(prefix || controlOption.prefix)
      for (let p = 0; p < prefixStrList.length; p++) {
        const value = prefixStrList[p]
        elementList.splice(i, 0, {
          ...controlContext,
          ...thePrePostfixArg,
          controlId,
          value,
          type: el.type,
          control: el.control,
          controlComponent: ControlComponent.PREFIX
        })
        i++
      }
      if (
        (value && value.length) ||
        type === ControlType.CHECKBOX ||
        type === ControlType.RADIO ||
        (type === ControlType.SELECT && code && (!value || !value.length))
      ) {
        let valueList: IElement[] = value ? deepClone(value) : []
        if (type === ControlType.CHECKBOX) {
          const codeList = code ? code.split(',') : []
          if (Array.isArray(valueSets) && valueSets.length) {
            const valueStyleList = valueList.reduce(
              (pre, cur) =>
                pre.concat(
                  cur.value.split('').map(v => ({ ...cur, value: v }))
                ),
              [] as IElement[]
            )
            let valueStyleIndex = 0
            for (let v = 0; v < valueSets.length; v++) {
              const valueSet = valueSets[v] as { code: string; value: string }
              elementList.splice(i, 0, {
                ...controlContext,
                ...controlDefaultStyle,
                controlId,
                value: '',
                type: el.type,
                control: el.control,
                controlComponent: ControlComponent.CHECKBOX,
                checkbox: {
                  code: valueSet.code,
                  value: codeList.includes(valueSet.code)
                }
              })
              i++
              const valueStrList = splitText(valueSet.value)
              for (let e = 0; e < valueStrList.length; e++) {
                const value = valueStrList[e]
                const isLastLetter = e === valueStrList.length - 1
                elementList.splice(i, 0, {
                  ...controlContext,
                  ...controlDefaultStyle,
                  ...valueStyleList[valueStyleIndex],
                  controlId,
                  value: value === '\n' ? ZERO : value,
                  letterSpacing: isLastLetter ? checkboxOption.gap : 0,
                  control: el.control,
                  controlComponent: ControlComponent.VALUE
                })
                valueStyleIndex++
                i++
              }
            }
          }
        } else if (type === ControlType.RADIO) {
          if (Array.isArray(valueSets) && valueSets.length) {
            const valueStyleList = valueList.reduce(
              (pre, cur) =>
                pre.concat(
                  cur.value.split('').map(v => ({ ...cur, value: v }))
                ),
              [] as IElement[]
            )
            let valueStyleIndex = 0
            for (let v = 0; v < valueSets.length; v++) {
              const valueSet = valueSets[v] as { code: string; value: string }
              elementList.splice(i, 0, {
                ...controlContext,
                ...controlDefaultStyle,
                controlId,
                value: '',
                type: el.type,
                control: el.control,
                controlComponent: ControlComponent.RADIO,
                radio: {
                  code: valueSet.code,
                  value: code === valueSet.code
                }
              })
              i++
              const valueStrList = splitText(valueSet.value)
              for (let e = 0; e < valueStrList.length; e++) {
                const value = valueStrList[e]
                const isLastLetter = e === valueStrList.length - 1
                elementList.splice(i, 0, {
                  ...controlContext,
                  ...controlDefaultStyle,
                  ...valueStyleList[valueStyleIndex],
                  controlId,
                  value: value === '\n' ? ZERO : value,
                  letterSpacing: isLastLetter ? radioOption.gap : 0,
                  control: el.control,
                  controlComponent: ControlComponent.VALUE
                })
                valueStyleIndex++
                i++
              }
            }
          }
        } else {
          if (!value || !value.length) {
            const typedValueSets = valueSets as Array<{ code: string; value: string }> | undefined
            if (typedValueSets?.length) {
              const valueSet = typedValueSets.find(v => v.code === code)
              if (valueSet) {
                valueList = [
                  {
                    value: valueSet.value
                  } as IElement
                ]
              }
            }
          }
          await formatElementList(valueList, {
            ...options,
            isHandleFirstElement: false,
            isForceCompensation: false
          })
          for (let v = 0; v < valueList.length; v++) {
            const element = valueList[v]
            const val = element.value
            elementList.splice(i, 0, {
              ...controlContext,
              ...controlDefaultStyle,
              ...element,
              controlId,
              value: val === '\n' ? ZERO : val,
              type: element.type || ElementType.TEXT,
              control: el.control,
              controlComponent: ControlComponent.VALUE
            })
            i++
          }
        }
      } else if (placeholder) {
        const thePlaceholderArgs: Omit<IElement, 'value'> = {
          ...controlDefaultStyle,
          color: editorOptions.control.placeholderColor
        }
        const placeholderStrList = splitText(placeholder)
        for (let p = 0; p < placeholderStrList.length; p++) {
          const value = placeholderStrList[p]
          elementList.splice(i, 0, {
            ...controlContext,
            ...thePlaceholderArgs,
            controlId,
            value: value === '\n' ? ZERO : value,
            type: el.type,
            control: el.control,
            controlComponent: ControlComponent.PLACEHOLDER
          })
          i++
        }
      }
      const postfixStrList = splitText(postfix || controlOption.postfix)
      for (let p = 0; p < postfixStrList.length; p++) {
        const value = postfixStrList[p]
        elementList.splice(i, 0, {
          ...controlContext,
          ...thePrePostfixArg,
          controlId,
          value,
          type: el.type,
          control: el.control,
          controlComponent: ControlComponent.POSTFIX
        })
        i++
      }
      i--
    } else if (el.type === ElementType.HYPERLINK) {
      elementList.splice(i, 1)
      const valueList = el.valueList || []
      const unzippedList: IElement[] = []
      for (let v = 0; v < valueList.length; v++) {
        const item = valueList[v]
        const texts = splitText(item.value)
        for (let d = 0; d < texts.length; d++) {
          unzippedList.push({ ...item, value: texts[d] })
        }
      }
      if (unzippedList.length) {
        const hyperlinkId = getUUID()
        for (let v = 0; v < unzippedList.length; v++) {
          const value = unzippedList[v]
          value.type = el.type
          value.url = el.url
          value.hyperlinkId = hyperlinkId
          elementList.splice(i, 0, value)
          i++
        }
      }
      i--
    } else if (
      (!el.type || TEXTLIKE_ELEMENT_TYPE.includes(el.type)) &&
      el.value.length > 1
    ) {
      elementList.splice(i, 1)
      const valueList = splitText(el.value)
      for (let v = 0; v < valueList.length; v++) {
        elementList.splice(i + v, 0, { ...el, value: valueList[v] })
      }
      el = elementList[i]
    }
    if (el.value === '\n' || el.value == '\r\n') {
      el.value = ZERO
    }
    if (el.type === ElementType.IMAGE || el.type === ElementType.BLOCK) {
      el.id = getUUID()
    }
    i++
  }
}
