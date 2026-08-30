import type { ICommentLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-comment'

export const DEFAULT_LOCALE = 'zhCN'

export const DEFAULT_HIGHLIGHT_COLOR = '#fde7e9'

export const DEFAULT_RAIL_WIDTH = 220

export const DEFAULT_LINE_COLOR = '#f54a45'

// 批注卡片作者名颜色
export const DEFAULT_USER_COLOR = '#f54a45'

// 批注卡片之间的垂直间距
export const CARD_GAP = 8

export const PLUGIN_LANG_MAP: Record<string, ICommentLang> = {
  zhCN: {
    addCommentText: '添加批注',
    removeCommentText: '删除批注',
    placeholderText: '请输入批注内容',
    confirmText: '确定',
    cancelText: '取消'
  },
  en: {
    addCommentText: 'Add Comment',
    removeCommentText: 'Remove Comment',
    placeholderText: 'Please enter comment',
    confirmText: 'OK',
    cancelText: 'Cancel'
  }
}
