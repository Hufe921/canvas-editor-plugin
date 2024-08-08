import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent
} from '@hufe921/canvas-editor'
import './index.css'
import { Lang } from './enum/Lang'
import { IDiagramOption } from './interface/Diagram'
import { DOMAIN, FORMAT, QUERIES } from './constant'
import {
  MessageAction,
  MessageEventType,
  MessageKey,
  ModifiedType,
  SpinKey
} from './enum/Message'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeLoadDiagram(option?: IDiagramOption): void
  }
}

class Diagram {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private mainContainer: HTMLDivElement
  private iframe: HTMLIFrameElement
  private options: IDiagramOption
  private watchMessage: (evt: MessageEvent) => void
  private xml: string | null

  constructor(options?: IDiagramOption) {
    this.options = {
      lang: Lang.ZH,
      ...options
    }
    // 创建并缓存dom
    const { mask, container, mainContainer } = this.createDialog()
    this.mask = mask
    this.container = container
    this.mainContainer = mainContainer
    const iframe = this.createDiagramIframe()
    this.mainContainer.append(iframe)
    this.iframe = iframe
    // diagram数据缓存
    this.xml = null
    // 监听diagram消息
    this.watchMessage = (evt: MessageEvent) => {
      if (evt.source === this.iframe.contentWindow && evt.data.length > 0) {
        const msg = JSON.parse(evt.data)
        if (!msg) return
        this.receiveMessage(msg)
      }
    }
    this.registerEventBus()
  }

  private registerEventBus() {
    window.addEventListener('message', this.watchMessage)
  }

  private removeEventBus() {
    window.removeEventListener('message', this.watchMessage)
  }

  private createDialog() {
    // 渲染遮罩层
    const mask = document.createElement('div')
    mask.classList.add('diagram-dialog-mask')
    mask.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    document.body.append(mask)
    // 渲染容器
    const container = document.createElement('div')
    container.classList.add('diagram-dialog-container')
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    // 弹窗
    const dialogContainer = document.createElement('div')
    dialogContainer.classList.add('diagram-dialog')
    container.append(dialogContainer)
    // 标题容器
    const titleContainer = document.createElement('div')
    titleContainer.classList.add('diagram-dialog-title')
    // 关闭按钮
    const titleClose = document.createElement('i')
    titleClose.onclick = () => {
      this.destroy()
    }
    titleContainer.append(titleClose)
    dialogContainer.append(titleContainer)
    // 正文容器
    const mainContainer = document.createElement('div')
    mainContainer.classList.add('diagram-dialog-main')
    dialogContainer.append(mainContainer)
    document.body.append(container)
    return {
      mask,
      container,
      mainContainer
    }
  }

  private createDiagramIframe() {
    const paramsString = Object.keys(QUERIES)
      .map(key => {
        // @ts-ignore
        return `${key}=${QUERIES[key]}`
      })
      .join('&')
    const iframe = document.createElement('iframe')
    iframe.setAttribute(
      'src',
      `${DOMAIN}?${paramsString}&lang=${this.options.lang}`
    )
    return iframe
  }

  private receiveMessage(message: any) {
    if (message.event === MessageEventType.CONFIGURE) {
      this.configure()
    } else if (message.event === MessageEventType.INIT) {
      this.init()
    } else if (message.event === MessageEventType.SAVE) {
      this.xml = message.xml
      if (message.exit) {
        message.event = MessageEventType.EXIT
      } else {
        this.postMessage({
          action: MessageAction.STATUS,
          messageKey: MessageKey.AllChangesSaved,
          modified: false
        })
      }
    } else if (message.event === MessageEventType.EXPORT) {
      // 导出后销毁
      this.destroy(message)
    }
    if (message.event === MessageEventType.EXIT) {
      if (this.xml) {
        this.postMessage({
          action: MessageAction.EXPORT,
          format: FORMAT,
          xml: this.xml,
          spinKey: SpinKey.EXPORT
        })
      } else {
        this.destroy()
      }
    }
  }

  private configure() {
    this.postMessage({
      action: MessageEventType.CONFIGURE,
      config: QUERIES.configure
    })
  }

  private init() {
    this.postMessage({
      action: MessageAction.LOAD,
      autosave: 0,
      saveAndExit: '1',
      modified: ModifiedType.UnSavedChanges,
      xml: this.options.data || ''
    })
  }

  private postMessage(message: object) {
    this.iframe!.contentWindow!.postMessage(JSON.stringify(message), '*')
  }

  private destroy(message?: any) {
    this.mask.remove()
    this.container.remove()
    this.removeEventBus()
    this.options.onDestroy?.(message)
  }
}

export default function diagramPlugin(editor: Editor) {
  const command = editor.command

  command.executeLoadDiagram = (option: IDiagramOption = {}) => {
    new Diagram(option)
  }
}
