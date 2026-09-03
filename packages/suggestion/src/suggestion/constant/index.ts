import type { ISuggestionLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-suggestion'

export const DEFAULT_LOCALE = 'zhCN'

export const DEFAULT_MIN_LENGTH = 1

export const DEFAULT_MAX_COUNT = 5

export const DEFAULT_DEBOUNCE = 200

// 查询词终止字符：空白、换行、标点、零宽字符
export const QUERY_STOP_REGEXP = /[\s\p{P}\u200B\uFEFF]/u

export const PLUGIN_LANG_MAP: Record<string, ISuggestionLang> = {
  zhCN: {
    emptyText: '无匹配结果'
  },
  en: {
    emptyText: 'No results'
  }
}
