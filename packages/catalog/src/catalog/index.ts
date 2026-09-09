import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  EditorZone,
  ICatalogItem,
  PageMode,
  TitleLevel
} from '@hufe921/canvas-editor'
import { ICatalogLang, ICatalogPluginOption } from './interface'
import { DEFAULT_LOCALE, PLUGIN_LANG_MAP, PLUGIN_PREFIX } from './constant'
import './style/index.scss'

// 标题层级缩进深度
const LEVEL_DEPTH: Record<TitleLevel, number> = {
  [TitleLevel.FIRST]: 0,
  [TitleLevel.SECOND]: 1,
  [TitleLevel.THIRD]: 2,
  [TitleLevel.FOURTH]: 3,
  [TitleLevel.FIFTH]: 4,
  [TitleLevel.SIXTH]: 5
}

interface IFlattenCatalogItem {
  id: string
  name: string
  pageNo: number
  depth: number
}

// 目录面板类
class Catalog {
  private readonly DEBOUNCE_TIME = 300
  private command: Editor['command']
  private eventBus: Editor['eventBus']
  private lang: ICatalogLang
  // 挂载容器内的目录元素
  private container: HTMLDivElement
  private listContainer!: HTMLDivElement
  // 平铺后的目录项（文档顺序）
  private flattenItems: IFlattenCatalogItem[] = []
  private itemElementMap: Map<string, HTMLDivElement> = new Map()
  private activeId: string | null = null
  private refreshTimer: number | undefined
  private disposed = false
  // 布局完成时的首次页码事件不作为滚动跟随信号，避免初始加载就高亮
  private firstIntersection = true

  constructor(
    editor: Editor,
    options: ICatalogPluginOption,
    lang: ICatalogLang
  ) {
    this.command = editor.command
    this.eventBus = editor.eventBus
    this.lang = lang
    this.container = this._render(options.container)
    this._bindEvent()
    this._refreshCatalog()
  }

  private _render(container: HTMLElement): HTMLDivElement {
    // 目录元素：渲染到传入的挂载容器内，填满容器
    const catalog = document.createElement('div')
    catalog.classList.add(PLUGIN_PREFIX)
    catalog.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    // 标题
    const titleContainer = document.createElement('div')
    titleContainer.classList.add(`${PLUGIN_PREFIX}-title`)
    titleContainer.append(document.createTextNode(this.lang.titleText))
    catalog.append(titleContainer)
    // 目录列表
    this.listContainer = document.createElement('div')
    this.listContainer.classList.add(`${PLUGIN_PREFIX}-list`)
    catalog.append(this.listContainer)
    container.append(catalog)
    return catalog
  }

  private _bindEvent() {
    // 文档内容变化后刷新目录
    this.eventBus.on('contentChange', this._onContentChange)
    // 滚动时根据当前页码高亮对应章节
    this.eventBus.on(
      'intersectionPageNoChange',
      this._onIntersectionPageNoChange
    )
    // 光标位置变化时，高亮光标所在章节
    this.eventBus.on('rangeChange', this._onRangeChange)
  }

  private _onContentChange = () => {
    window.clearTimeout(this.refreshTimer)
    this.refreshTimer = window.setTimeout(() => {
      this._refreshCatalog()
    }, this.DEBOUNCE_TIME)
  }

  private _onIntersectionPageNoChange = (pageNo: number) => {
    if (this.firstIntersection) {
      this.firstIntersection = false
      return
    }
    if (this._isContinuityMode()) return
    // 高亮当前页码之前（含）最近的标题，即浏览位置所在的章节
    let current: IFlattenCatalogItem | null = null
    for (const item of this.flattenItems) {
      if (item.pageNo <= pageNo) {
        current = item
      } else {
        break
      }
    }
    if (current && current.id !== this.activeId) {
      this._setActive(current.id)
    }
  }

  private _onRangeChange = () => {
    if (this.disposed) return
    const context = this.command.getRangeContext()
    // 仅联动正文区域，页眉页脚内的光标不更新目录
    if (!context || context.zone !== EditorZone.MAIN) return
    // titleId 即光标前面最近的标题，也就是光标所在章节
    if (context.titleId && context.titleId !== this.activeId) {
      this._setActive(context.titleId)
    }
  }

  private _isContinuityMode(): boolean {
    // 低版本编辑器（<1.0.2）无 command.getOptions 方法，做兼容处理
    return (this.command as any).getOptions?.().pageMode === PageMode.CONTINUITY
  }

  private _refreshCatalog() {
    this.command.getCatalog().then(catalog => {
      if (this.disposed) return
      this._renderList(catalog || [])
    })
  }

  private _renderList(catalog: ICatalogItem[]) {
    // 重建列表时保留滚动位置
    const scrollTop = this.listContainer.scrollTop
    this.flattenItems = []
    this.itemElementMap.clear()
    this.listContainer.innerHTML = ''
    if (!catalog.length) {
      const empty = document.createElement('div')
      empty.classList.add(`${PLUGIN_PREFIX}-empty`)
      empty.append(document.createTextNode(this.lang.emptyText))
      this.listContainer.append(empty)
      return
    }
    const flatten = (items: ICatalogItem[]) => {
      for (const item of items) {
        this.flattenItems.push({
          id: item.id,
          name: item.name,
          pageNo: item.pageNo,
          depth: LEVEL_DEPTH[item.level] ?? 0
        })
        if (item.subCatalog?.length) {
          flatten(item.subCatalog)
        }
      }
    }
    flatten(catalog)
    for (const item of this.flattenItems) {
      const itemElement = document.createElement('div')
      itemElement.classList.add(`${PLUGIN_PREFIX}-item`)
      itemElement.style.paddingLeft = `${12 + item.depth * 16}px`
      itemElement.title = item.name
      itemElement.append(document.createTextNode(item.name))
      // 点击目录项定位到对应标题
      itemElement.onclick = () => {
        this.command.executeLocationCatalog(item.id)
        this._setActive(item.id)
      }
      if (item.id === this.activeId) {
        itemElement.classList.add('active')
      }
      this.itemElementMap.set(item.id, itemElement)
      this.listContainer.append(itemElement)
    }
    this.listContainer.scrollTop = scrollTop
  }

  private _setActive(id: string) {
    this.activeId = id
    this.itemElementMap.forEach((element, itemId) => {
      element.classList.toggle('active', itemId === id)
    })
    // 高亮项滚动到可视范围内
    this.itemElementMap.get(id)?.scrollIntoView({ block: 'nearest' })
  }

  public dispose() {
    this.disposed = true
    window.clearTimeout(this.refreshTimer)
    this.eventBus.off('contentChange', this._onContentChange)
    this.eventBus.off(
      'intersectionPageNoChange',
      this._onIntersectionPageNoChange
    )
    this.eventBus.off('rangeChange', this._onRangeChange)
    this.container.remove()
  }
}

export default function catalogPlugin(
  editor: Editor,
  options?: ICatalogPluginOption
) {
  if (!options?.container) {
    throw new Error('canvas-editor-plugin-catalog: container is required')
  }
  const command = editor.command

  // 国际化：优先插件 locale 配置，其次编辑器 locale 配置，回退 zhCN
  const getLang = (): ICatalogLang => {
    // 低版本编辑器（<1.0.2）无 command.getOptions 方法，做兼容处理
    const editorLocale = (command as any).getOptions?.().locale as
      | string
      | undefined
    const currentLocale = (options.locale || editorLocale || DEFAULT_LOCALE)
      .toLowerCase()
      .replace(/[-_]/g, '')
    const sourceLang =
      Object.entries(PLUGIN_LANG_MAP).find(
        ([langKey]) => langKey.toLowerCase() === currentLocale
      )?.[1] || PLUGIN_LANG_MAP[DEFAULT_LOCALE]
    return {
      ...sourceLang,
      ...options.lang
    }
  }

  const catalog = new Catalog(editor, options, getLang())

  // 编辑器销毁时移除目录与事件监听
  const originalDestroy = editor.destroy
  editor.destroy = () => {
    catalog.dispose()
    originalDestroy()
  }
}

export type { ICatalogLang, ICatalogPluginOption }
