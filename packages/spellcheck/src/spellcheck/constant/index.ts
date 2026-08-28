import { ISpellcheckLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-spellcheck'

export const DEFAULT_SUGGESTION_COUNT = 3

export const DEFAULT_SUGGESTION_TIMEOUT = 100

export const DEFAULT_MIN_WORD_LENGTH = 1

export const DEFAULT_LOCALE = 'zhCN'

export const ICON_ALERT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'

export const ICON_EYE_OFF =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'

export const PLUGIN_LANG_MAP: Record<string, ISpellcheckLang> = {
  zhCN: {
    ignoreText: '忽略',
    emptyText: '暂无建议'
  },
  en: {
    ignoreText: 'Ignore',
    emptyText: 'No suggestions'
  }
}
