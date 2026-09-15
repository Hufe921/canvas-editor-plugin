/**
 * canvas-editor-pdf 工具函数模块
 *
 * 本模块包含常量定义和通用工具函数，
 * 从 canvas-editor 源码复制，保持与源码一致。
 */

import { UlStyle, BLOCK_ELEMENT_TYPE, TEXTLIKE_ELEMENT_TYPE, ElementType, ControlComponent } from '../types'
import type { IElement, IElementFillRect } from '../types'

/**
 * 零宽字符，用于占位和行首光标定位
 */
export const ZERO_CHAR = '\u200B'

/**
 * 换行符常量
 */
export const WRAP = '\n'

/**
 * 水平制表符常量
 */
export const HORIZON_TAB = '\t'

/**
 * 空格常量
 */
export const NBSP = '\u0020'

/**
 * 度量基准文本（用于计算字体度量）
 */
export const METRICS_BASIS_TEXT = '中'

/**
 * 无序列表样式映射
 */
export const ulStyleMapping: Record<UlStyle, string> = {
  [UlStyle.DISC]: '•',
  [UlStyle.CIRCLE]: '◦',
  [UlStyle.SQUARE]: '▫︎',
  [UlStyle.CHECKBOX]: '☑️'
}

/**
 * 标点符号列表
 */
export const PUNCTUATION_LIST = [
  '·',
  '、',
  ':',
  '：',
  ',',
  '，',
  '.',
  '。',
  ';',
  '；',
  '?',
  '？',
  '!',
  '！'
]

/**
 * 字母类别定义
 */
export const LETTER_CLASS = {
  ENGLISH: 'A-Za-z',
  SPANISH: 'A-Za-zÁÉÍÓÚáéíóúÑñÜü',
  FRENCH: 'A-Za-zÀÂÇàâçÉéÈèÊêËëÎîÏïÔôÙùÛûŸÿ',
  GERMAN: 'A-Za-zÄäÖöÜüß',
  RUSSIAN: 'А-Яа-яЁё',
  PORTUGUESE: 'A-Za-zÁÉÍÓÚáéíóúÃÕãõÇç',
  ITALIAN: 'A-Za-zÀàÈèÉéÌìÍíÎîÓóÒòÙù',
  DUTCH: 'A-Za-zÀàÁáÂâÄäÈèÉéÊêËëÌìÍíÎîÏïÓóÒòÔôÖöÙùÛûÜü',
  SWEDISH: 'A-Za-zÅåÄäÖö',
  GREEK: 'ΑαΒβΓγΔδΕεΖζΗηΘθΙιΚκΛλΜμΝνΞξΟοΠπΡρΣσςΤτΥυΦφΧχΨψΩω'
}

/**
 * 标点符号正则表达式
 */
export const PUNCTUATION_REG =
  /[、，。？！；：……「」“”‘’*（）【】〔〕〖〗〘〙〚〛《》———﹝﹞–—\\/·.,!?;:`~<>()[\]{}'"|]/

/**
 * 行首换行符正则表达式
 */
export const START_LINE_BREAK_REG = new RegExp(`^[${ZERO_CHAR}\n]`)

/**
 * 生成 RFC 4122 v4 风格的 UUID
 *
 * @returns 形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 的 UUID 字符串
 */
export function getUUID(): string {
  function S4(): string {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1)
  }
  return (
    S4() +
    S4() +
    '-' +
    S4() +
    '-' +
    S4() +
    '-' +
    S4() +
    '-' +
    S4() +
    S4() +
    S4()
  )
}

/**
 * 从对象中挑选指定属性，返回新对象
 *
 * @param obj 源对象
 * @param keys 要挑选的属性键数组
 * @returns 只包含指定属性的新对象
 */
export function pickObject<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * 深拷贝一个对象/数组
 *
 * 优先使用原生 `structuredClone`，不可用时回退到递归实现。
 *
 * @param obj 待拷贝的值
 * @returns 与入参结构相同但无引用关联的副本
 */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj)
  }
  if (!obj || typeof obj !== 'object') {
    return obj
  }
  let newObj = {} as T
  if (Array.isArray(obj)) {
    newObj = obj.map(item => deepClone(item)) as T
  } else {
    const keys = Object.keys(obj) as (keyof T)[]
    keys.forEach(key => {
      newObj[key] = deepClone(obj[key])
    })
  }
  return newObj
}

/**
 * 将文本拆分为字符/字形数组
 *
 * 优先使用 `Intl.Segmenter`（按字形簇分割，正确处理 emoji 等代理对），
 * 不可用时回退到按码元逐字符遍历。
 *
 * @param text 待拆分的文本
 * @returns 字符/字形数组
 */
export function splitText(text: string): string[] {
  const data: string[] = []
  if (Intl.Segmenter) {
    const segmenter = new Intl.Segmenter()
    const segments = segmenter.segment(text)
    for (const { segment } of segments) {
      data.push(segment)
    }
  } else {
    for (let t = 0; t < text.length; t++) {
      data.push(text[t])
    }
  }
  return data
}

/**
 * 从元素列表中挑出所有「环绕」(SURROUND) 显示模式的图片元素
 *
 * 这些图片会脱离正文流，按 `imgFloatPosition` 定位，并影响后续文本的避让计算。
 *
 * @param elementList 全量元素列表
 * @returns 环绕图片元素列表（引用原对象，不拷贝）
 */
export function pickSurroundElementList(elementList: IElement[]): IElement[] {
  const surroundElementList: IElement[] = []
  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]
    if (element.imgDisplay === 'surround') {
      surroundElementList.push(element)
    }
  }
  return surroundElementList
}

/**
 * 判断元素是否为「块级」元素
 *
 * 块级类型（BLOCK/PAGE_BREAK/SEPARATOR/TABLE）或行内图片（INLINE）均视为块级。
 *
 * @param element 待判断的元素
 * @returns true=块级元素
 */
export function getIsBlockElement(element?: IElement): boolean {
  return (
    !!element?.type &&
    (BLOCK_ELEMENT_TYPE.includes(element.type) ||
      element.imgDisplay === 'inline')
  )
}

/**
 * 从环绕元素列表中移除已绑定到指定页码的元素
 *
 * 当某页的环绕图片已被处理完毕后调用，避免后续页重复计算避让。
 * 倒序遍历以安全 splice。
 *
 * @param surroundElementList 环绕元素列表（会被原地修改）
 * @param pageNo 目标页码
 */
export function deleteSurroundElementList(
  surroundElementList: IElement[],
  pageNo: number
): void {
  for (let i = surroundElementList.length - 1; i >= 0; i--) {
    const element = surroundElementList[i]
    if (element.imgFloatPosition?.pageNo === pageNo) {
      surroundElementList.splice(i, 1)
    }
  }
}

/**
 * 在元素列表指定位置执行 splice 操作
 *
 * 对 `Array.prototype.splice` 的薄封装，供 `computeRowList` 在拆分/插入控件占位元素时使用。
 *
 * @param elementList 目标元素列表（会被原地修改）
 * @param index 起始索引
 * @param deleteCount 待删除元素个数
 * @param items 待插入的元素
 */
export function spliceElementList(
  elementList: IElement[],
  index: number,
  deleteCount: number,
  ...items: IElement[]
): void {
  elementList.splice(index, deleteCount, ...items)
}

/**
 * 判断两个矩形是否相交
 *
 * 用于环绕图片与正文行的避让判定。
 *
 * @param rect1 第一个矩形（x, y, width, height）
 * @param rect2 第二个矩形
 * @returns true=两矩形有重叠区域
 */
export function isRectIntersect(
  rect1: IElementFillRect,
  rect2: IElementFillRect
): boolean {
  const rect1Left = rect1.x
  const rect1Right = rect1.x + rect1.width
  const rect1Top = rect1.y
  const rect1Bottom = rect1.y + rect1.height
  const rect2Left = rect2.x
  const rect2Right = rect2.x + rect2.width
  const rect2Top = rect2.y
  const rect2Bottom = rect2.y + rect2.height
  if (
    rect1Left > rect2Right ||
    rect1Right < rect2Left ||
    rect1Top > rect2Bottom ||
    rect1Bottom < rect2Top
  ) {
    return false
  }
  return true
}

/**
 * 将阿拉伯数字转换为中文数字
 *
 * 支持到亿位，用于页码 `{pageCount}` 占位符在 `numberType: 'chinese'` 时的格式化。
 *
 * @param num 非负整数
 * @returns 中文数字字符串
 */
export function convertNumberToChinese(num: number): string {
  const chineseNumMap = [
    '零',
    '一',
    '二',
    '三',
    '四',
    '五',
    '六',
    '七',
    '八',
    '九'
  ]
  const chineseUnitMap = ['', '十', '百', '千', '万', '十', '百', '千', '亿']
  if (num === 0) return chineseNumMap[0]
  const numStr = String(num)
  let result = ''
  for (let i = 0; i < numStr.length; i++) {
    const digit = Number(numStr[i])
    const unit = chineseUnitMap[numStr.length - i - 1]
    if (digit === 0) {
      if (result && !result.endsWith(chineseNumMap[0])) {
        result += chineseNumMap[0]
      }
    } else {
      result += chineseNumMap[digit] + unit
    }
  }
  return result
}

/**
 * 判断元素是否为文本类元素
 *
 * @param element 待判断的元素
 * @returns true=文本类元素
 */
export function isTextLikeElement(element?: IElement): boolean {
  return !element?.type || TEXTLIKE_ELEMENT_TYPE.includes(element.type)
}

/**
 * 过滤辅助元素（前缀、后缀、占位符）
 *
 * 在 PRINT 模式下，清空控件的前缀 `{`、后缀 `}` 和占位符的值，
 * 使控件内容直接显示而不带有花括号包裹。
 *
 * @param elementList 元素列表
 * @returns 过滤后的元素列表
 */
export function filterAssistElement(elementList: IElement[]): IElement[] {
  return elementList.filter(element => {
    if (element.type === ElementType.TABLE) {
      const trList = element.trList!
      for (let r = 0; r < trList.length; r++) {
        const tr = trList[r]
        if (!tr.tdList) continue
        for (let d = 0; d < tr.tdList.length; d++) {
          const td = tr.tdList[d]
          td.value = filterAssistElement(td.value)
        }
      }
    }
    if (!element.controlId) return true
    if (
      element.controlComponent === ControlComponent.PREFIX ||
      element.controlComponent === ControlComponent.POSTFIX ||
      element.controlComponent === ControlComponent.PLACEHOLDER
    ) {
      element.value = ''
      return true
    }
    return true
  })
}
