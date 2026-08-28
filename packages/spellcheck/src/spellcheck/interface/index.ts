export interface ISpellcheckLang {
  // 弹窗忽略按钮文案
  ignoreText: string
  // 弹窗无建议文案
  emptyText: string
}

export interface ISpellcheckPluginOption {
  // 是否禁用拼写检查
  disabled?: boolean
  // 建议词候选个数
  suggestionCount?: number
  // 建议词生成超时时间（毫秒）
  suggestionTimeout?: number
  // 忽略词列表（不区分大小写）
  ignoreWords?: string[]
  // 参与检查的最小单词长度
  minWordLength?: number
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹窗文案
  lang?: Partial<ISpellcheckLang>
}

// 以下为 canvas-editor@1.0.2 运行时提供但类型包未导出的拼写检查相关类型
export interface ISpellcheckContext {
  tableId?: string
  tableIndex?: number
  trIndex?: number
  tdIndex?: number
}

export interface ISpellcheckWord extends ISpellcheckContext {
  word: string
  startIndex: number
  endIndex: number
}

export interface ISpellcheckRange extends ISpellcheckContext {
  startIndex: number
  endIndex: number
  // 插件自定义数据，点击事件原样回传
  data?: unknown
}

export interface ISpellcheckClickPayload {
  evt: MouseEvent
  range: ISpellcheckRange
}
