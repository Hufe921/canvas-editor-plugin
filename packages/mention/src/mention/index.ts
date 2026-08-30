import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  ElementType
} from '@hufe921/canvas-editor'
import type { IElement, IRange } from '@hufe921/canvas-editor'
import type { IMentionItem, IMentionLang, IMentionOptions } from './interface'
import {
  DEFAULT_LOCALE,
  DEFAULT_MAX_COUNT,
  DEFAULT_TRIGGER,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX
} from './constant'
import './style'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeMention(options?: IMentionOptions): void
  }
}

class Mention {
  private editor: Editor
  private defaultOptions?: IMentionOptions
  private options: IMentionOptions
  private lang: IMentionLang
  private trigger: string
  private container: HTMLDivElement | null = null
  // 触发符所在元素索引（程序化打开时为当前光标索引）
  private triggerIndex = -1
  // 是否由 executeMention 程序化打开（无触发符文本，选中后直接插入）
  private isProgrammatic = false
  private isOpen = false

  constructor(editor: Editor, defaultOptions?: IMentionOptions) {
    this.editor = editor
    this.defaultOptions = defaultOptions
    this.options = this.mergeOptions()
    this.lang = this.getLang()
    this.trigger = this.options.trigger || DEFAULT_TRIGGER
    // 监听输入：未打开时检测触发符，打开时刷新查询词
    editor.eventBus.on('input', this.inputHandler)
    // 点击已插入的提及标签
    editor.eventBus.on('labelMousedown', this.labelMousedownHandler)
  }

  private inputHandler = (evt: Event) => {
    if (!this.isOpen) {
      if ((evt as InputEvent).data === this.trigger) {
        this.open(false)
      }
      return
    }
    if (this.isProgrammatic) {
      // 程序化打开时不跟踪查询词，仅刷新定位
      this.updatePosition()
      return
    }
    this.refresh()
  }

  private rangeChangeHandler = (range: IRange) => {
    if (!this.isOpen) return
    // 光标移动到触发符之前时关闭
    if (range.startIndex <= this.triggerIndex) {
      this.close()
    }
  }

  private labelMousedownHandler = (payload: { element: IElement }) => {
    this.options.onClick?.(payload.element)
  }

  private mergeOptions(options?: IMentionOptions): IMentionOptions {
    return {
      ...this.defaultOptions,
      ...options,
      dataList: options?.dataList ?? this.defaultOptions?.dataList ?? [],
      label: {
        ...this.defaultOptions?.label,
        ...options?.label
      }
    }
  }

  private getLang(options?: IMentionOptions): IMentionLang {
    // 国际化：优先单次调用 locale 配置，其次插件默认 locale 配置，
    // 再次编辑器 locale 配置，回退 zhCN
    // 低版本编辑器无 command.getOptions 方法，做兼容处理
    const editorLocale = (this.editor.command as any).getOptions?.().locale as
      string | undefined
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

  private getDataList(): IMentionItem[] {
    const { dataList } = this.options
    if (typeof dataList === 'function') return dataList()
    return dataList || []
  }

  private filterDataList(query: string): IMentionItem[] {
    const max = this.options.max ?? DEFAULT_MAX_COUNT
    const keyword = query.toLowerCase()
    return this.getDataList()
      .filter(item => item.name.toLowerCase().includes(keyword))
      .slice(0, max)
  }

  private renderList(itemList: IMentionItem[], query: string) {
    if (!this.container) return
    this.container.innerHTML = ''
    if (!itemList.length) {
      const empty = document.createElement('div')
      empty.classList.add(`${PLUGIN_PREFIX}-empty`)
      // 无查询词时显示提示文案，有查询词时显示无匹配文案
      empty.innerText = query ? this.lang.emptyText : this.lang.placeholderText
      this.container.append(empty)
      return
    }
    itemList.forEach(item => {
      const itemDom = document.createElement('div')
      itemDom.classList.add(`${PLUGIN_PREFIX}-item`)
      itemDom.innerText = item.name
      // 用 mousedown 并阻止默认行为，避免编辑器失焦、选区塌陷
      itemDom.onmousedown = evt => {
        evt.preventDefault()
        this.select(item)
      }
      this.container!.append(itemDom)
    })
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
    const { startIndex } = command.getRange()
    this.triggerIndex = startIndex
    this.isProgrammatic = isProgrammatic
    this.isOpen = true
    if (!this.container) {
      this.container = document.createElement('div')
      this.container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
      this.container.classList.add(PLUGIN_PREFIX)
    }
    command.getContainer().append(this.container)
    this.renderList(this.filterDataList(''), '')
    this.updatePosition()
    this.editor.eventBus.on('rangeChange', this.rangeChangeHandler)
  }

  private close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.editor.eventBus.off('rangeChange', this.rangeChangeHandler)
    this.container?.remove()
  }

  private refresh() {
    const command = this.editor.command
    const elementList = command.getValue().data.main
    const { startIndex } = command.getRange()
    // 触发符被删除时关闭
    if (elementList[this.triggerIndex]?.value !== this.trigger) {
      this.close()
      return
    }
    // 光标移动到触发符之前时关闭
    if (startIndex <= this.triggerIndex) {
      this.close()
      return
    }
    // 拼接触发符之后到光标之间的文本作为查询词
    const query = elementList
      .slice(this.triggerIndex + 1, startIndex + 1)
      .map(element => element.value)
      .join('')
    this.renderList(this.filterDataList(query), query)
    this.updatePosition()
  }

  private select(item: IMentionItem) {
    const command = this.editor.command
    if (!this.isProgrammatic) {
      // 选中 @查询词 整段，插入时替换（选区不含 startIndex 本身，需 -1 包住触发符）
      const { startIndex } = command.getRange()
      command.executeSetRange(this.triggerIndex - 1, startIndex)
    }
    command.executeInsertElementList([
      {
        type: ElementType.LABEL,
        value: `${this.trigger}${item.name}`,
        labelId: item.id,
        label: {
          color: '#347ef2',
          backgroundColor: '#f2f6fc',
          borderRadius: 4,
          ...this.options.label
        }
      }
    ])
    this.options.onSelect?.(item)
    this.close()
  }

  public execute(options?: IMentionOptions) {
    this.options = this.mergeOptions(options)
    this.lang = this.getLang(options)
    this.trigger = this.options.trigger || DEFAULT_TRIGGER
    this.open(true)
  }
}

export default function mentionPlugin(
  editor: Editor,
  defaultOptions?: IMentionOptions
) {
  const command = editor.command
  // 单例：重复 executeMention 不重建
  const mention = new Mention(editor, defaultOptions)

  command.executeMention = (options?: IMentionOptions) => {
    mention.execute(options)
  }
}
