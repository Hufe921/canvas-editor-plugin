import Editor from '@hufe921/canvas-editor'
import './style/index.scss'
import { ToolbarType } from './enum'
import { IToolbarRegister } from './interface'
import { PLUGIN_PREFIX } from './constant'

// 工具栏列表
const toolbarRegisterList: IToolbarRegister[] = [
  {
    key: ToolbarType.SIZE_ADD,
    callback(editor) {
      editor.command.executeSizeAdd()
    }
  },
  {
    key: ToolbarType.SIZE_MINUS,
    callback(editor) {
      editor.command.executeSizeMinus()
    }
  },
  {
    key: ToolbarType.BOLD,
    callback(editor) {
      editor.command.executeBold()
    }
  },
  {
    key: ToolbarType.ITALIC,
    callback(editor) {
      editor.command.executeItalic()
    }
  },
  {
    key: ToolbarType.UNDERLINE,
    callback(editor) {
      editor.command.executeUnderline()
    }
  },
  {
    key: ToolbarType.STRIKEOUT,
    callback(editor) {
      editor.command.executeStrikeout()
    }
  }
]

function createToolbar(editor: Editor): HTMLDivElement {
  const toolbarContainer = document.createElement('div')
  toolbarContainer.classList.add(`${PLUGIN_PREFIX}-floating-toolbar`)
  for (const toolbar of toolbarRegisterList) {
    const { key, callback } = toolbar
    const toolbarItem = document.createElement('div')
    toolbarItem.classList.add(`${PLUGIN_PREFIX}-${key}`)
    const icon = document.createElement('i')
    toolbarItem.append(icon)
    toolbarItem.onclick = () => {
      callback(editor)
    }
    toolbarContainer.append(toolbarItem)
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

export default function floatingToolbarPlugin(editor: Editor) {
  // 创建工具栏
  const toolbarContainer = createToolbar(editor)
  document.body.append(toolbarContainer)

  // 监听选区样式变化
  editor.eventBus.on('rangeStyleChange', rangeStyle => {
    if (rangeStyle.type === null) {
      toggleToolbarVisible(toolbarContainer, false)
      return
    }
    const context = editor.command.getRangeContext()
    if (!context || !context.rangeRects[0]) {
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
