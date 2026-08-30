import type { IMentionLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-mention'

export const DEFAULT_LOCALE = 'zhCN'

export const DEFAULT_TRIGGER = '@'

export const DEFAULT_MAX_COUNT = 5

export const PLUGIN_LANG_MAP: Record<string, IMentionLang> = {
  zhCN: {
    emptyText: '无匹配结果',
    placeholderText: '输入以筛选'
  },
  en: {
    emptyText: 'No results',
    placeholderText: 'Type to filter'
  }
}
