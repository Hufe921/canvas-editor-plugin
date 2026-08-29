import { ISignatureLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-signature'

export const DEFAULT_LOCALE = 'zhCN'

export const DEFAULT_EXPORT_TYPE = 'svg'

export const PLUGIN_LANG_MAP: Record<string, ISignatureLang> = {
  zhCN: {
    titleText: '插入签名',
    undoText: '撤销',
    clearText: '清空',
    cancelText: '取消',
    confirmText: '确定'
  },
  en: {
    titleText: 'Insert Signature',
    undoText: 'Undo',
    clearText: 'Clear',
    cancelText: 'Cancel',
    confirmText: 'OK'
  }
}
