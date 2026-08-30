import {
  Command,
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  KeyMap
} from '@hufe921/canvas-editor'
import {
  IFindReplaceLang,
  IFindReplaceOption,
  IFindReplacePluginOption
} from './interface'
import { DEFAULT_LOCALE, PLUGIN_LANG_MAP, PLUGIN_PREFIX } from './constant'
import { CLOSE_SVG } from './style'
import './style/index.scss'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeFindReplace(options?: IFindReplaceOption): void
  }
}

// 查找替换浮动面板类
class FindReplace {
  private readonly DEBOUNCE_TIME = 300
  private command: Command
  private options: IFindReplaceOption
  private lang: IFindReplaceLang
  private container: HTMLDivElement
  private findInput!: HTMLInputElement
  private replaceInput!: HTMLInputElement
  private matchCaseCheckbox!: HTMLInputElement
  private matchInfo!: HTMLSpanElement
  private searchDebounceTimer: number | undefined
  private dragOffset: { x: number; y: number } | null = null

  constructor(
    command: Command,
    options: IFindReplaceOption,
    lang: IFindReplaceLang
  ) {
    this.command = command
    this.options = options
    this.lang = lang
    this.container = this._render()
    this._setDefaultPosition()
    this._bindEvent()
    this.findInput.focus()
  }

  // 默认位置：以编辑器区域水平居中（顶部 header 区域）
  private _setDefaultPosition() {
    const editorRect = this.command.getContainer().getBoundingClientRect()
    const panelWidth = this.container.offsetWidth
    const left = Math.max(
      Math.min(
        editorRect.left + (editorRect.width - panelWidth) / 2,
        window.innerWidth - panelWidth
      ),
      0
    )
    this.container.style.left = `${left}px`
  }

  private _render(): HTMLDivElement {
    const {
      titleText,
      findPlaceholder,
      replacePlaceholder,
      prevText,
      nextText,
      replaceText,
      replaceAllText,
      matchCaseText
    } = this.lang
    // 非模态浮动面板：不使用遮罩层，便于查看文档中的搜索高亮并继续编辑
    const container = document.createElement('div')
    container.classList.add(`${PLUGIN_PREFIX}-container`)
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    // 面板
    const panel = document.createElement('div')
    panel.classList.add(PLUGIN_PREFIX)
    container.append(panel)
    // 标题容器
    const titleContainer = document.createElement('div')
    titleContainer.classList.add(`${PLUGIN_PREFIX}-title`)
    // 标题&关闭按钮
    const titleSpan = document.createElement('span')
    titleSpan.append(document.createTextNode(titleText))
    const titleClose = document.createElement('i')
    titleClose.innerHTML = CLOSE_SVG
    titleClose.onclick = () => {
      this.dispose()
    }
    titleContainer.append(titleSpan)
    titleContainer.append(titleClose)
    panel.append(titleContainer)
    // 标题栏拖拽调整面板位置
    this._bindDrag(titleContainer)
    // 查找输入框&匹配信息
    const findContainer = document.createElement('div')
    findContainer.classList.add(`${PLUGIN_PREFIX}-row`)
    this.findInput = document.createElement('input')
    this.findInput.placeholder = findPlaceholder
    this.matchInfo = document.createElement('span')
    this.matchInfo.classList.add(`${PLUGIN_PREFIX}-match-info`)
    findContainer.append(this.findInput)
    findContainer.append(this.matchInfo)
    panel.append(findContainer)
    // 替换输入框
    const replaceContainer = document.createElement('div')
    replaceContainer.classList.add(`${PLUGIN_PREFIX}-row`)
    this.replaceInput = document.createElement('input')
    this.replaceInput.placeholder = replacePlaceholder
    replaceContainer.append(this.replaceInput)
    panel.append(replaceContainer)
    // 区分大小写选项
    const optionContainer = document.createElement('div')
    optionContainer.classList.add(`${PLUGIN_PREFIX}-row`)
    const matchCaseLabel = document.createElement('label')
    matchCaseLabel.classList.add(`${PLUGIN_PREFIX}-match-case`)
    this.matchCaseCheckbox = document.createElement('input')
    this.matchCaseCheckbox.type = 'checkbox'
    matchCaseLabel.append(this.matchCaseCheckbox)
    matchCaseLabel.append(document.createTextNode(matchCaseText))
    optionContainer.append(matchCaseLabel)
    panel.append(optionContainer)
    // 按钮容器
    const menuContainer = document.createElement('div')
    menuContainer.classList.add(`${PLUGIN_PREFIX}-menu`)
    // 上一个按钮
    const prevBtn = document.createElement('button')
    prevBtn.type = 'button'
    prevBtn.append(document.createTextNode(prevText))
    prevBtn.onclick = () => {
      this._navigatePre()
    }
    menuContainer.append(prevBtn)
    // 下一个按钮
    const nextBtn = document.createElement('button')
    nextBtn.type = 'button'
    nextBtn.append(document.createTextNode(nextText))
    nextBtn.onclick = () => {
      this._navigateNext()
    }
    menuContainer.append(nextBtn)
    // 替换按钮
    const replaceBtn = document.createElement('button')
    replaceBtn.type = 'button'
    replaceBtn.append(document.createTextNode(replaceText))
    replaceBtn.onclick = () => {
      this._replace()
    }
    menuContainer.append(replaceBtn)
    // 全部替换按钮
    const replaceAllBtn = document.createElement('button')
    replaceAllBtn.type = 'submit'
    replaceAllBtn.append(document.createTextNode(replaceAllText))
    replaceAllBtn.onclick = () => {
      this._replaceAll()
    }
    menuContainer.append(replaceAllBtn)
    panel.append(menuContainer)
    // 渲染
    document.body.append(container)
    return container
  }

  private _bindEvent() {
    // 查找输入防抖搜索
    this.findInput.addEventListener('input', () => {
      window.clearTimeout(this.searchDebounceTimer)
      this.searchDebounceTimer = window.setTimeout(() => {
        this._search()
      }, this.DEBOUNCE_TIME)
    })
    // 回车立即搜索并定位到下一个匹配
    this.findInput.addEventListener('keydown', evt => {
      if (evt.key === 'Enter') {
        window.clearTimeout(this.searchDebounceTimer)
        this._search()
        this._navigateNext()
      }
    })
    // 切换区分大小写后重新搜索
    this.matchCaseCheckbox.addEventListener('change', () => {
      this._search()
    })
    // Escape 关闭面板
    this.container.addEventListener('keydown', evt => {
      if (evt.key === 'Escape') {
        this.dispose()
      }
    })
  }

  private _bindDrag(titleContainer: HTMLDivElement) {
    titleContainer.addEventListener('mousedown', evt => {
      // 关闭按钮区域不触发拖拽
      if ((evt.target as HTMLElement).closest('i')) return
      evt.preventDefault()
      const rect = this.container.getBoundingClientRect()
      // 拖拽期间以显式 left/top 定位
      this.container.style.left = `${rect.left}px`
      this.container.style.top = `${rect.top}px`
      this.dragOffset = {
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top
      }
      document.addEventListener('mousemove', this._onDragMove)
      document.addEventListener('mouseup', this._onDragEnd)
    })
  }

  private _onDragMove = (evt: MouseEvent) => {
    if (!this.dragOffset) return
    // 限制在可视区域内
    const left = Math.min(
      Math.max(evt.clientX - this.dragOffset.x, 0),
      window.innerWidth - this.container.offsetWidth
    )
    const top = Math.min(
      Math.max(evt.clientY - this.dragOffset.y, 0),
      window.innerHeight - this.container.offsetHeight
    )
    this.container.style.left = `${left}px`
    this.container.style.top = `${top}px`
  }

  private _onDragEnd = () => {
    this.dragOffset = null
    document.removeEventListener('mousemove', this._onDragMove)
    document.removeEventListener('mouseup', this._onDragEnd)
  }

  private _search() {
    const keyword = this.findInput.value
    if (keyword) {
      // 核心默认忽略大小写（isIgnoreCase: true），
      // 勾选“区分大小写”时需显式传 false
      this.command.executeSearch(keyword, {
        isIgnoreCase: !this.matchCaseCheckbox.checked
      })
    } else {
      this.command.executeSearch(null)
    }
    this._refreshMatchInfo()
  }

  private _refreshMatchInfo() {
    const info = this.command.getSearchNavigateInfo()
    this.matchInfo.textContent = info ? `${info.index}/${info.count}` : ''
  }

  private _navigatePre() {
    this.command.executeSearchNavigatePre()
    this._refreshMatchInfo()
  }

  private _navigateNext() {
    this.command.executeSearchNavigateNext()
    this._refreshMatchInfo()
  }

  private _replace() {
    const info = this.command.getSearchNavigateInfo()
    if (!info) return
    // getSearchNavigateInfo 的 index 从 1 开始，
    // replace 的 index 为匹配组下标（从 0 开始）
    this.command.executeReplace(this.replaceInput.value, {
      index: info.index - 1
    })
    // 替换后重新搜索同一关键词并刷新匹配信息
    this._search()
  }

  private _replaceAll() {
    // 不传 index 即全部替换
    this.command.executeReplace(this.replaceInput.value)
    this._search()
  }

  public focus() {
    this.findInput.focus()
    this.findInput.select()
  }

  public dispose() {
    window.clearTimeout(this.searchDebounceTimer)
    // 移除可能未结束的拖拽监听
    document.removeEventListener('mousemove', this._onDragMove)
    document.removeEventListener('mouseup', this._onDragEnd)
    // 清除搜索高亮
    this.command.executeSearch(null)
    this.container.remove()
    this.options.onClose?.()
  }
}

export default function findReplacePlugin(
  editor: Editor,
  defaultOptions?: IFindReplacePluginOption
) {
  const command = editor.command
  let findReplace: FindReplace | null = null

  command.executeFindReplace = (options?: IFindReplaceOption) => {
    // 国际化：优先单次调用 locale 配置，其次插件默认 locale 配置，
    // 再次编辑器 locale 配置，回退 zhCN
    const getLang = (): IFindReplaceLang => {
      // 低版本编辑器（<1.0.2）无 command.getOptions 方法，做兼容处理
      const editorLocale = (command as any).getOptions?.().locale as
        | string
        | undefined
      const currentLocale = (
        options?.locale ||
        defaultOptions?.locale ||
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
        ...defaultOptions?.lang,
        ...options?.lang
      }
    }
    // 面板已存在时聚焦查找输入框，不重复创建
    if (findReplace) {
      findReplace.focus()
      return
    }
    findReplace = new FindReplace(
      command,
      {
        ...(options || {}),
        onClose: () => {
          findReplace = null
          options?.onClose?.()
        }
      },
      getLang()
    )
  }

  // 注册全局快捷键 Ctrl/Cmd + F 唤起面板（可通过插件配置 shortcut: false 关闭）
  if (defaultOptions?.shortcut !== false) {
    editor.register.shortcutList([
      {
        key: KeyMap.F,
        mod: true,
        isGlobal: true,
        callback: () => {
          command.executeFindReplace()
        }
      }
    ])
  }
}

export type { IFindReplaceLang, IFindReplaceOption, IFindReplacePluginOption }
