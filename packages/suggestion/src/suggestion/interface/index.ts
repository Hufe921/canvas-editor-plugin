// 候选数据项
export interface ISuggestionItem {
  id: string
  name: string
  // 选中后实际插入的短语，缺省时插入 name
  value?: string
  [key: string]: any
}

export interface ISuggestionLang {
  // 无匹配候选时的空态文案
  emptyText: string
}

// 匹配方式：前缀匹配、包含匹配或自定义匹配函数（内置方式均大小写不敏感）
export type ISuggestionMatch =
  | 'prefix'
  | 'contains'
  | ((query: string, item: ISuggestionItem) => boolean)

export interface ISuggestionOptions {
  // 候选数据（数组或返回数组的函数）
  dataList: ISuggestionItem[] | (() => ISuggestionItem[])
  // 触发联想的最小查询词长度，默认 1
  minLength?: number
  // 候选最多显示条数，默认 5
  max?: number
  // 匹配方式，默认 prefix
  match?: ISuggestionMatch
  // 选中候选项回调
  onSelect?: (item: ISuggestionItem) => void
  // 面板语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的面板文案
  lang?: Partial<ISuggestionLang>
}
