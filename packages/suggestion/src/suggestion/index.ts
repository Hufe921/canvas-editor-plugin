import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  ElementType
} from '@hufe921/canvas-editor'
import type {
  ISuggestionItem,
  ISuggestionLang,
  ISuggestionOptions
} from './interface'
import {
  DEFAULT_DEBOUNCE,
  DEFAULT_LOCALE,
  DEFAULT_MAX_COUNT,
  DEFAULT_MIN_LENGTH,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX,
  QUERY_STOP_REGEXP
} from './constant'
import './style'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeSuggestion(options?: ISuggestionOptions): void
  }
}

class Suggestion {
  private editor: Editor
  private defaultOptions?: ISuggestionOptions
  private options: ISuggestionOptions
  private lang: ISuggestionLang
  private container: HTMLDivElement | null = null
  private isOpen = false
  // 是否由 executeSuggestion 程序化打开（不跟踪查询词，选中后直接插入）
  private isProgrammatic = false
  // 当前候选列表及键盘高亮索引
  private itemList: ISuggestionItem[] = []
  private activeIndex = -1
  private debounceTimer: number | null = null

  constructor(editor: Editor, defaultOptions?: ISuggestionOptions) {
    this.editor = editor
    this.defaultOptions = defaultOptions
    this.options = this.mergeOptions()
    this.lang = this.getLang()
    // 监听输入：防抖后提取光标前查询词，打开或刷新候选面板
    editor.eventBus.on('input', this.inputHandler)
  }

  private inputHandler = () => {
    if (this.isOpen && this.isProgrammatic) {
      // 程序化打开时不跟踪查询词，仅刷新定位
      this.updatePosition()
      return
    }
    this.scheduleRefresh()
  }

  private rangeChangeHandler = () => {
    if (!this.isOpen || this.isProgrammatic) return
    // 光标移动后重新提取查询词：不再紧跟查询词时提取为空，面板随之关闭
    this.scheduleRefresh()
  }

  private docMousedownHandler = (evt: MouseEvent) => {
    if (!this.isOpen) return
    // 点击面板外部时关闭
    if (this.container?.contains(evt.target as Node)) return
    this.close()
  }

  private keydownHandler = (evt: KeyboardEvent) => {
    if (!this.isOpen) return
    switch (evt.key) {
      case 'ArrowDown':
        this.moveActive(1)
        break
      case 'ArrowUp':
        this.moveActive(-1)
        break
      case 'Enter':
      case 'Tab':
        // 无候选时不拦截按键，交由编辑器处理
        if (!this.itemList.length) return
        this.selectActive()
        break
      case 'Escape':
        this.close()
        break
      default:
        return
    }
    // 捕获阶段拦截，避免编辑器响应以上按键
    evt.preventDefault()
    evt.stopPropagation()
  }

  private mergeOptions(options?: ISuggestionOptions): ISuggestionOptions {
    return {
      ...this.defaultOptions,
      ...options,
      dataList: options?.dataList ?? this.defaultOptions?.dataList ?? []
    }
  }

  private getLang(options?: ISuggestionOptions): ISuggestionLang {
    // 国际化：优先单次调用 locale 配置，其次插件默认 locale 配置，
    // 再次编辑器 locale 配置，回退 zhCN
    // 低版本编辑器无 command.getOptions 方法，做兼容处理
    const editorLocale = (this.editor.command as any).getOptions?.().locale as
      | string
      | undefined
    const currentLocale = (
      options?.locale ||
      this.defaultOptions?.locale ||
      editorLocale ||
      DEFAULT_LOCALE
    )
      .toLowerCase()
      .replace(/[-_]/g, '')
    const sourceLang =
      Object.entries(PLUGIN_LANG_MAP).find(
        ([key]) => key.toLowerCase() === currentLocale
      )?.[1] || PLUGIN_LANG_MAP[DEFAULT_LOCALE]
    return {
      ...sourceLang,
      ...this.defaultOptions?.lang,
      ...options?.lang
    }
  }

  private getDataList(): ISuggestionItem[] {
    const { dataList } = this.options
    if (typeof dataList === 'function') return dataList()
    return dataList || []
  }

  private matchItem(query: string, item: ISuggestionItem): boolean {
    const match = this.options.match || 'prefix'
    if (typeof match === 'function') return match(query, item)
    const keyword = query.toLowerCase()
    const name = item.name.toLowerCase()
    return match === 'contains'
      ? name.includes(keyword)
      : name.startsWith(keyword)
  }

  private filterDataList(query: string): ISuggestionItem[] {
    const max = this.options.max ?? DEFAULT_MAX_COUNT
    return this.getDataList()
      .filter(item => this.matchItem(query, item))
      .slice(0, max)
  }

  // 从光标处向前提取查询词。注意：1.0.x 中连续输入的文本会合并为
  // 一个多字符元素，range 索引按字符单位计数（非文本元素占 1 单位），
  // 因此需逐字符回溯，遇到空白、标点、换行或非文本元素即停止
  private extractQuery(): { query: string; startIndex: number } {
    const command = this.editor.command
    const { startIndex } = command.getRange()
    const elementList = command.getValue().data.main
    let query = ''
    // 光标前的字符单位数
    let rest = startIndex
    for (let i = elementList.length - 1; i >= 0 && rest > 0; i--) {
      const element = elementList[i]
      if (element.type && element.type !== ElementType.TEXT) break
      const chars = Array.from(element.value || '')
      // 光标可能落在元素内部，只取光标前的字符
      const take = Math.min(chars.length, rest)
      for (let c = take - 1; c >= 0; c--) {
        const char = chars[c]
        if (QUERY_STOP_REGEXP.test(char)) return { query, startIndex }
        query = char + query
        rest--
      }
    }
    return { query, startIndex }
  }

  private scheduleRefresh() {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null
      this.refresh()
    }, DEFAULT_DEBOUNCE)
  }

  private refresh() {
    const { query } = this.extractQuery()
    const minLength = this.options.minLength ?? DEFAULT_MIN_LENGTH
    if (query.length < minLength) {
      this.close()
      return
    }
    if (!this.isOpen) {
      this.open(false)
    }
    this.renderList(this.filterDataList(query))
    this.updatePosition()
  }

  private renderList(itemList: ISuggestionItem[]) {
    if (!this.container) return
    this.itemList = itemList
    this.activeIndex = itemList.length ? 0 : -1
    this.container.innerHTML = ''
    if (!itemList.length) {
      const empty = document.createElement('div')
      empty.classList.add(`${PLUGIN_PREFIX}-empty`)
      empty.innerText = this.lang.emptyText
      this.container.append(empty)
      return
    }
    itemList.forEach((item, index) => {
      const itemDom = document.createElement('div')
      itemDom.classList.add(`${PLUGIN_PREFIX}-item`)
      if (index === this.activeIndex) {
        itemDom.classList.add('active')
      }
      itemDom.innerText = item.name
      // 用 mousedown 并阻止默认行为，避免编辑器失焦、选区塌陷
      itemDom.onmousedown = evt => {
        evt.preventDefault()
        this.select(item)
      }
      this.container!.append(itemDom)
    })
  }

  private moveActive(delta: number) {
    const len = this.itemList.length
    if (!len || !this.container) return
    // 循环移动高亮项
    this.activeIndex = (this.activeIndex + delta + len) % len
    const itemDoms = this.container.querySelectorAll<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-item`
    )
    itemDoms.forEach((itemDom, index) => {
      itemDom.classList.toggle('active', index === this.activeIndex)
    })
    itemDoms[this.activeIndex]?.scrollIntoView({ block: 'nearest' })
  }

  private selectActive() {
    const item = this.itemList[this.activeIndex]
    if (item) {
      this.select(item)
    }
  }

  private updatePosition() {
    if (!this.container) return
    const context = this.editor.command.getRangeContext()
    const rect = context?.rangeRects?.[0]
    if (!rect) {
      this.close()
      return
    }
    // 浮层与编辑器书写区同坐标系，定位于光标下方
    this.container.style.left = `${rect.x}px`
    this.container.style.top = `${rect.y + rect.height + 4}px`
  }

  private open(isProgrammatic: boolean) {
    const command = this.editor.command
    this.isProgrammatic = isProgrammatic
    this.isOpen = true
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
      this.container.classList.add(PLUGIN_PREFIX)
    }
    command.getContainer().append(this.container)
    this.editor.eventBus.on('rangeChange', this.rangeChangeHandler)
    // 捕获阶段监听键盘导航，优先于编辑器自身按键处理
    command
      .getContainer()
      .addEventListener('keydown', this.keydownHandler, true)
    document.addEventListener('mousedown', this.docMousedownHandler)
  }

  private close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.isProgrammatic = false
    this.itemList = []
    this.activeIndex = -1
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.editor.eventBus.off('rangeChange', this.rangeChangeHandler)
    this.editor.command
      .getContainer()
      .removeEventListener('keydown', this.keydownHandler, true)
    document.removeEventListener('mousedown', this.docMousedownHandler)
    this.container?.remove()
  }

  private select(item: ISuggestionItem) {
    const command = this.editor.command
    if (!this.isProgrammatic) {
      // 重新提取查询词（防抖间隙可能又有输入），
      // 选中查询词整段以便替换（选区不含 startIndex 本身，起点需再前移一位）
      const { query, startIndex } = this.extractQuery()
      if (query) {
        command.executeSetRange(startIndex - query.length, startIndex)
      }
    }
    const phrase = item.value ?? item.name
    command.executeInsertElementList(
      Array.from(phrase).map(value => ({ value }))
    )
    this.options.onSelect?.(item)
    this.close()
  }

  public execute(options?: ISuggestionOptions) {
    // 已打开时先关闭，避免监听器重复注册
    this.close()
    this.options = this.mergeOptions(options)
    this.lang = this.getLang(options)
    this.open(true)
    this.renderList(this.filterDataList(''))
    this.updatePosition()
  }
}

export default function suggestionPlugin(
  editor: Editor,
  defaultOptions?: ISuggestionOptions
) {
  const command = editor.command
  // 单例：重复 executeSuggestion 不重建
  const suggestion = new Suggestion(editor, defaultOptions)

  command.executeSuggestion = (options?: ISuggestionOptions) => {
    suggestion.execute(options)
  }
}
