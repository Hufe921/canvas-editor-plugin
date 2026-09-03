export interface IFormulaLang {
  editMenuText: string
  cancelText: string
  confirmText: string
  errorText: string
}

export interface IFormulaOption {
  // 是否注册公式编辑右键菜单，默认 true
  isRegisterEditContextMenu?: boolean
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹窗文案
  lang?: Partial<IFormulaLang>
}
