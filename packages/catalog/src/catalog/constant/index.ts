import { ICatalogLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-catalog'

export const DEFAULT_LOCALE = 'zhCN'

export const PLUGIN_LANG_MAP: Record<string, ICatalogLang> = {
  zhCN: {
    titleText: '目录',
    emptyText: '暂无标题'
  },
  en: {
    titleText: 'Catalog',
    emptyText: 'No headings'
  }
}
