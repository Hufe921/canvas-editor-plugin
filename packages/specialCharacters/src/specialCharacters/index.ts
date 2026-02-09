import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  ElementType
} from '@hufe921/canvas-editor'
import { ISpecialCharactersOption } from './interface'
import { DEFAULT_CHARACTERS, PLUGIN_PREFIX } from './constant'
import { CLOSE_BUTTON_SVG } from './style'
import './style/index.scss'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeOpenSpecialCharactersDialog(options?: ISpecialCharactersOption): void
  }
}

// 特殊字符弹窗类
class SpecialCharactersDialog {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private options: ISpecialCharactersOption
  private activeCategory: string

  constructor(options: ISpecialCharactersOption = {}) {
    this.options = {
      characters: DEFAULT_CHARACTERS,
      ...options
    }
    // 默认选中第一个分类
    this.activeCategory = this.options.characters?.[0]?.name || ''
    const { mask, container } = this.createDialog()
    this.mask = mask
    this.container = container
  }

  // 创建弹窗DOM结构
  private createDialog(): { mask: HTMLDivElement; container: HTMLDivElement } {
    const mask = document.createElement('div')
    mask.classList.add(`${PLUGIN_PREFIX}-mask`)

    const container = document.createElement('div')
    container.classList.add(`${PLUGIN_PREFIX}-container`)
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)

    const header = this.createHeader()
    const body = this.createBody()

    container.append(header, body)
    document.body.append(mask, container)

    mask.onclick = () => this.destroy()

    return { mask, container }
  }

  // 创建头部
  private createHeader(): HTMLDivElement {
    const header = document.createElement('div')
    header.classList.add(`${PLUGIN_PREFIX}-header`)

    const title = document.createElement('span')
    title.textContent = '特殊字符'
    title.classList.add(`${PLUGIN_PREFIX}-title`)

    const closeBtn = document.createElement('span')
    closeBtn.innerHTML = CLOSE_BUTTON_SVG
    closeBtn.classList.add(`${PLUGIN_PREFIX}-close-btn`)

    closeBtn.onclick = () => this.destroy()

    header.append(title, closeBtn)
    return header
  }

  // 创建主体内容区域
  private createBody(): HTMLDivElement {
    const body = document.createElement('div')
    body.classList.add(`${PLUGIN_PREFIX}-body`)

    const sidebar = this.createSidebar()
    const content = this.createContent()

    body.append(sidebar, content)
    return body
  }

  // 创建侧边栏
  private createSidebar(): HTMLDivElement {
    const sidebar = document.createElement('div')
    sidebar.classList.add(`${PLUGIN_PREFIX}-sidebar`)

    this.options.characters?.forEach(group => {
      const item = document.createElement('div')
      item.textContent = group.name
      item.classList.add(`${PLUGIN_PREFIX}-sidebar-item`)

      if (group.name === this.activeCategory) {
        item.classList.add('active')
      }

      item.onclick = () => {
        this.activeCategory = group.name
        this.updateSidebarSelection()
        this.updateContent()
      }

      sidebar.appendChild(item)
    })

    return sidebar
  }

  // 更新侧边栏选中状态
  private updateSidebarSelection(): void {
    const sidebar = this.container.querySelector(
      `.${PLUGIN_PREFIX}-sidebar`
    ) as HTMLDivElement
    if (!sidebar) return

    const items = sidebar.querySelectorAll(`.${PLUGIN_PREFIX}-sidebar-item`)
    items.forEach(item => {
      if (item.textContent === this.activeCategory) {
        item.classList.add('active')
      } else {
        item.classList.remove('active')
      }
    })
  }

  // 创建内容区域
  private createContent(): HTMLDivElement {
    const content = document.createElement('div')
    content.classList.add(`${PLUGIN_PREFIX}-content`)

    const activeGroup = this.options.characters?.find(
      g => g.name === this.activeCategory
    )
    if (activeGroup) {
      this.renderCharacters(content, activeGroup.characters)
    }

    return content
  }

  // 更新内容区域
  private updateContent(): void {
    const content = this.container.querySelector(
      `.${PLUGIN_PREFIX}-content`
    ) as HTMLDivElement
    if (!content) return

    content.innerHTML = ''
    const activeGroup = this.options.characters?.find(
      g => g.name === this.activeCategory
    )
    if (activeGroup) {
      this.renderCharacters(content, activeGroup.characters)
    }
  }

  // 渲染字符列表
  private renderCharacters(container: HTMLDivElement, characters: any[]): void {
    const charsGrid = document.createElement('div')
    charsGrid.classList.add(`${PLUGIN_PREFIX}-chars-grid`)

    characters.forEach(charInfo => {
      const charBtn = document.createElement('button')
      charBtn.textContent = charInfo.char
      charBtn.title = charInfo.name
      charBtn.classList.add(`${PLUGIN_PREFIX}-char-btn`)

      charBtn.onclick = () => {
        this.options.onSelect?.(charInfo.char)
        this.destroy()
      }

      charsGrid.append(charBtn)
    })

    container.append(charsGrid)
  }

  // 销毁弹窗
  private destroy() {
    this.mask.remove()
    this.container.remove()
  }
}

export default function specialCharactersPlugin(
  editor: Editor,
  defaultOptions?: ISpecialCharactersOption
) {
  const command = editor.command

  command.executeOpenSpecialCharactersDialog = (
    options?: ISpecialCharactersOption
  ) => {
    const mergedOptions: ISpecialCharactersOption = {
      characters:
        options?.characters ?? defaultOptions?.characters ?? DEFAULT_CHARACTERS,
      onSelect: (char: string) => {
        // 如果外部提供了onSelect回调，则不执行默认的插入逻辑
        const hasExternalOnSelect =
          options?.onSelect || defaultOptions?.onSelect

        if (hasExternalOnSelect) {
          options?.onSelect?.(char)
          defaultOptions?.onSelect?.(char)
        } else {
          command.executeInsertElementList([
            {
              type: ElementType.TEXT,
              value: char
            }
          ])
        }
      }
    }
    new SpecialCharactersDialog(mergedOptions)
  }
}
