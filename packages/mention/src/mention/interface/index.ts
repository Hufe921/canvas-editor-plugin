import type { IElement } from '@hufe921/canvas-editor'

// 候选数据项
export interface IMentionItem {
  id: string
  name: string
  [key: string]: any
}

// 提及标签内边距（上、右、下、左）
export type IMentionPadding = [number, number, number, number]

// 提及标签样式
export interface IMentionLabelStyle {
  color?: string
  backgroundColor?: string
  borderRadius?: number
  padding?: IMentionPadding
}

export interface IMentionLang {
  // 无匹配候选时的空态文案
  emptyText: string
  // 候选面板提示文案
  placeholderText: string
}

export interface IMentionOptions {
  // 触发符，默认 @
  trigger?: string
  // 候选数据（数组或返回数组的函数）
  dataList: IMentionItem[] | (() => IMentionItem[])
  // 选中候选项回调
  onSelect?: (item: IMentionItem) => void
  // 点击已插入提及标签回调
  onClick?: (element: IElement) => void
  // 提及标签样式覆盖
  label?: IMentionLabelStyle
  // 候选最多显示条数，默认 5
  max?: number
  // 面板语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的面板文案
  lang?: Partial<IMentionLang>
}
