export interface IFindReplaceLang {
  // 面板标题文案
  titleText: string
  // 查找输入框占位文案
  findPlaceholder: string
  // 替换输入框占位文案
  replacePlaceholder: string
  // 上一个按钮文案
  prevText: string
  // 下一个按钮文案
  nextText: string
  // 替换按钮文案
  replaceText: string
  // 全部替换按钮文案
  replaceAllText: string
  // 区分大小写选项文案
  matchCaseText: string
}

export interface IFindReplaceOption {
  // 面板语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的面板文案
  lang?: Partial<IFindReplaceLang>
  onClose?: () => void
}

export interface IFindReplacePluginOption {
  // 面板语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的面板文案
  lang?: Partial<IFindReplaceLang>
  // 是否启用全局快捷键 Ctrl/Cmd + F 唤起面板，默认启用
  shortcut?: boolean
}
