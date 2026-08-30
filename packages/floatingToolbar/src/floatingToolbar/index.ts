import '@simonwep/pickr/dist/themes/nano.min.css'
import Pickr from '@simonwep/pickr'
import Editor from '@hufe921/canvas-editor'
import './style/index.scss'
import { ToolbarType } from './enum'
import { IFloatingToolbarOptions, IToolbarRegister } from './interface'
import { PLUGIN_PREFIX } from './constant'

interface IRangeStyle {
  type: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strikeout: boolean
}

function createPickerToolbar(
  container: HTMLDivElement,
  toolbarType: ToolbarType,
  changed: (color: string) => void
) {
  const toolbarItem = document.createElement('div')
  toolbarItem.classList.add(`${PLUGIN_PREFIX}-picker`)
  toolbarItem.classList.add(`${PLUGIN_PREFIX}-${toolbarType}`)
  // 颜色选择容器
  const pickerContainer = document.createElement('div')
  pickerContainer.classList.add(`${PLUGIN_PREFIX}-picker-container`)
  const pickerDom = document.createElement('div')
  pickerContainer.append(pickerDom)
  toolbarItem.append(pickerContainer)
  container.append(toolbarItem)
  // 实例化颜色选择器
  const currentColor = '#000000'
  const pickr = new Pickr({
    el: pickerDom,
    theme: 'nano',
    useAsButton: true,
    inline: true,
    default: currentColor,
    i18n: {
      'btn:save': '✓'
    },
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        input: true,
        save: true
      }
    }
  })
  const icon = document.createElement('i')
  toolbarItem.append(icon)
  const colorBar = document.createElement('span')
  colorBar.style.backgroundColor = currentColor
  toolbarItem.append(colorBar)
  toolbarItem.onclick = evt => {
    const target = evt.target as HTMLElement
    if (pickerContainer !== target && !pickerContainer.contains(target)) {
      pickr.show()
    }
  }
  pickr.on('save', (cb: any) => {
    pickr.hide()
    const color = cb.toHEXA().toString()
    colorBar.style.backgroundColor = color
    changed(color)
  })
}

// 默认工具栏列表
const defaultToolbarRegisterList: IToolbarRegister[] = [
  {
    key: ToolbarType.SIZE_ADD,
    title: '增大字号',
    callback(editor) {
      editor.command.executeSizeAdd()
    }
  },
  {
    key: ToolbarType.SIZE_MINUS,
    title: '减小字号',
    callback(editor) {
      editor.command.executeSizeMinus()
    }
  },
  {
    isDivider: true
  },
  {
    key: ToolbarType.BOLD,
    title: '粗体',
    callback(editor) {
      editor.command.executeBold()
    }
  },
  {
    key: ToolbarType.ITALIC,
    title: '斜体',
    callback(editor) {
      editor.command.executeItalic()
    }
  },
  {
    key: ToolbarType.UNDERLINE,
    title: '下划线',
    callback(editor) {
      editor.command.executeUnderline()
    }
  },
  {
    key: ToolbarType.STRIKEOUT,
    title: '删除线',
    callback(editor) {
      editor.command.executeStrikeout()
    }
  },
  {
    isDivider: true
  },
  {
    key: ToolbarType.COLOR,
    title: '文字颜色',
    render(container, editor) {
      createPickerToolbar(container, ToolbarType.COLOR, color => {
        editor.command.executeColor(color)
      })
    }
  },
  {
    key: ToolbarType.HIGHLIGHT,
    title: '高亮颜色',
    render(container, editor) {
      createPickerToolbar(container, ToolbarType.HIGHLIGHT, color => {
        editor.command.executeHighlight(color)
      })
    }
  }
]

function createToolbar(
  editor: Editor,
  options?: IFloatingToolbarOptions
): HTMLDivElement {
  const toolbarContainer = document.createElement('div')
  toolbarContainer.classList.add(`${PLUGIN_PREFIX}-floating-toolbar`)

  let toolbarItems: IToolbarRegister[] = []

  // 决定是否显示默认工具栏
  if (!options || options.showDefaultItems !== false) {
    toolbarItems = [...defaultToolbarRegisterList]
  }

  // 添加自定义工具栏项
  if (options?.customItems?.length) {
    const customRegisterItems: IToolbarRegister[] = options.customItems.map(
      item => {
        // 处理分隔符情况
        if (item.isDivider) {
          return { isDivider: true }
        }

        return {
          key: item.key,
          title: item.title,
          icon: item.icon,
          callback: item.callback
        }
      }
    )

    toolbarItems = [...toolbarItems, ...customRegisterItems]
  }

  // 创建工具栏项
  for (const toolbar of toolbarItems) {
    if (toolbar.render) {
      toolbar.render(toolbarContainer, editor)
    } else if (toolbar.isDivider) {
      const divider = document.createElement('div')
      divider.classList.add(`${PLUGIN_PREFIX}-divider`)
      toolbarContainer.append(divider)
    } else {
      const { key, callback, title, icon } = toolbar

      if (key && callback) {
        const toolbarItem = document.createElement('div')
        toolbarItem.classList.add(`${PLUGIN_PREFIX}-${key}`)

        if (title) {
          toolbarItem.setAttribute('title', title)
        }

        const iconElement = document.createElement('i')
        if (icon) {
          if (icon.startsWith('.') || icon.startsWith('#')) {
            iconElement.className = icon.substring(1)
          } else {
            iconElement.textContent = icon
          }
        }

        toolbarItem.append(iconElement)
        toolbarItem.onclick = () => {
          callback(editor)
        }

        toolbarContainer.append(toolbarItem)
      }
    }
  }

  return toolbarContainer
}

function toggleToolbarVisible(toolbar: HTMLDivElement, visible: boolean) {
  visible ? toolbar.classList.remove('hide') : toolbar.classList.add('hide')
}

function toggleToolbarItemActive(toolbarItem: HTMLDivElement, active: boolean) {
  active
    ? toolbarItem.classList.add('active')
    : toolbarItem.classList.remove('active')
}

export default function floatingToolbarPlugin(
  editor: Editor,
  options?: IFloatingToolbarOptions
) {
  // 创建工具栏
  const toolbarContainer = createToolbar(editor, options)
  const editorContainer = editor.command.getContainer()
  editorContainer.append(toolbarContainer)

  // 监听选区样式变化
  editor.eventBus.on('rangeStyleChange', (rangeStyle: IRangeStyle) => {
    if (rangeStyle.type === null) {
      toggleToolbarVisible(toolbarContainer, false)
      return
    }
    const context = editor.command.getRangeContext()
    if (!context || context.isCollapsed || !context.rangeRects[0]) {
      toggleToolbarVisible(toolbarContainer, false)
      return
    }
    // 定位
    const position = context.rangeRects[0]
    toolbarContainer.style.left = `${position.x}px`
    toolbarContainer.style.top = `${position.y + position.height}px`
    // 样式回显
    const boldDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-bold`
    )
    if (boldDom) {
      toggleToolbarItemActive(boldDom, rangeStyle.bold)
    }
    const italicDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-italic`
    )
    if (italicDom) {
      toggleToolbarItemActive(italicDom, rangeStyle.italic)
    }
    const underlineDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-underline`
    )
    if (underlineDom) {
      toggleToolbarItemActive(underlineDom, rangeStyle.underline)
    }
    const strikeoutDom = toolbarContainer.querySelector<HTMLDivElement>(
      `.${PLUGIN_PREFIX}-strikeout`
    )
    if (strikeoutDom) {
      toggleToolbarItemActive(strikeoutDom, rangeStyle.strikeout)
    }
    toggleToolbarVisible(toolbarContainer, true)
  })
}
