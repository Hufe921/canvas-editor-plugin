import { IFormulaLang } from '../interface'

export const DEFAULT_LOCALE = 'zhCN'

export const PLUGIN_LANG_MAP: Record<string, IFormulaLang> = {
  zhCN: {
    editMenuText: '编辑公式',
    cancelText: '取消',
    confirmText: '确定',
    errorText: 'LaTeX 语法错误'
  },
  en: {
    editMenuText: 'Edit Formula',
    cancelText: 'Cancel',
    confirmText: 'OK',
    errorText: 'LaTeX syntax error'
  }
}
