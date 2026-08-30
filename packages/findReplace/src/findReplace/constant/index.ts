import { IFindReplaceLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-find-replace'

export const DEFAULT_LOCALE = 'zhCN'

export const PLUGIN_LANG_MAP: Record<string, IFindReplaceLang> = {
  zhCN: {
    titleText: '查找替换',
    findPlaceholder: '查找',
    replacePlaceholder: '替换为',
    prevText: '上一个',
    nextText: '下一个',
    replaceText: '替换',
    replaceAllText: '全部替换',
    matchCaseText: '区分大小写'
  },
  en: {
    titleText: 'Find and Replace',
    findPlaceholder: 'Find',
    replacePlaceholder: 'Replace with',
    prevText: 'Previous',
    nextText: 'Next',
    replaceText: 'Replace',
    replaceAllText: 'Replace All',
    matchCaseText: 'Match case'
  }
}
