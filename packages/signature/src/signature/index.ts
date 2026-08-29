import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  ElementType
} from '@hufe921/canvas-editor'
import {
  ISignatureLang,
  ISignatureOptions,
  ISignatureResult
} from './interface'
import {
  DEFAULT_EXPORT_TYPE,
  DEFAULT_LOCALE,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX
} from './constant'
import { CLOSE_SVG, UNDO_SVG, TRASH_SVG } from './style'
import './style/index.scss'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeSignature(options?: ISignatureOptions): void
  }
}

// 手写签名弹窗类
class Signature {
  private readonly MAX_RECORD_COUNT = 1000
  private readonly DEFAULT_WIDTH = 390
  private readonly DEFAULT_HEIGHT = 180
  private undoStack: Array<Function> = []
  private x = 0
  private y = 0
  private isDrawing = false
  private isDrawn = false
  private linePoints: [number, number][] = []
  // 笔画轨迹（x、y、线宽），用于 svg 导出
  private strokeList: [number, number, number][][] = []
  private canvasWidth: number
  private canvasHeight: number
  private options: ISignatureOptions
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private trashContainer: HTMLDivElement
  private undoContainer: HTMLDivElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private preTimeStamp: number
  private dpr: number
  private lang: ISignatureLang

  constructor(options: ISignatureOptions, lang: ISignatureLang) {
    this.options = options
    this.lang = lang
    this.preTimeStamp = 0
    this.dpr = window.devicePixelRatio
    this.canvasWidth = (options.width || this.DEFAULT_WIDTH) * this.dpr
    this.canvasHeight = (options.height || this.DEFAULT_HEIGHT) * this.dpr
    const { mask, container, trashContainer, undoContainer, canvas } =
      this._render()
    this.mask = mask
    this.container = container
    this.trashContainer = trashContainer
    this.undoContainer = undoContainer
    this.canvas = canvas
    this.ctx = <CanvasRenderingContext2D>canvas.getContext('2d')
    this.ctx.scale(this.dpr, this.dpr)
    this.ctx.lineCap = 'round'
    this._bindEvent()
    this._clearUndoFn()
    // this is necessary so that the screen does not move when moving - it is removed when closing the modal
    document.documentElement.classList.add(`${PLUGIN_PREFIX}-overflow-hidden`)
    document.body.classList.add(`${PLUGIN_PREFIX}-overflow-hidden`)
    this.container.classList.add(`${PLUGIN_PREFIX}-overflow-hidden`)
  }

  private _render() {
    const { onClose, onCancel, onConfirm } = this.options
    const { titleText, undoText, clearText, cancelText, confirmText } =
      this.lang
    // 渲染遮罩层
    const mask = document.createElement('div')
    mask.classList.add(`${PLUGIN_PREFIX}-mask`)
    mask.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    document.body.append(mask)
    // 渲染容器
    const container = document.createElement('div')
    container.classList.add(`${PLUGIN_PREFIX}-container`)
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    // 弹窗
    const signatureContainer = document.createElement('div')
    signatureContainer.classList.add(PLUGIN_PREFIX)
    container.append(signatureContainer)
    // 标题容器
    const titleContainer = document.createElement('div')
    titleContainer.classList.add(`${PLUGIN_PREFIX}-title`)
    // 标题&关闭按钮
    const titleSpan = document.createElement('span')
    titleSpan.append(document.createTextNode(titleText))
    const titleClose = document.createElement('i')
    titleClose.innerHTML = CLOSE_SVG
    titleClose.onclick = () => {
      if (onClose) {
        onClose()
      }
      this._dispose()
    }
    titleContainer.append(titleSpan)
    titleContainer.append(titleClose)
    signatureContainer.append(titleContainer)
    // 操作区
    const operationContainer = document.createElement('div')
    operationContainer.classList.add(`${PLUGIN_PREFIX}-operation`)
    // 撤销
    const undoContainer = document.createElement('div')
    undoContainer.classList.add(`${PLUGIN_PREFIX}-operation__undo`)
    const undoIcon = document.createElement('i')
    undoIcon.innerHTML = UNDO_SVG
    const undoLabel = document.createElement('span')
    undoLabel.innerText = undoText
    undoContainer.append(undoIcon)
    undoContainer.append(undoLabel)
    operationContainer.append(undoContainer)
    // 清空画布
    const trashContainer = document.createElement('div')
    trashContainer.classList.add(`${PLUGIN_PREFIX}-operation__trash`)
    const trashIcon = document.createElement('i')
    trashIcon.innerHTML = TRASH_SVG
    const trashLabel = document.createElement('span')
    trashLabel.innerText = clearText
    trashContainer.append(trashIcon)
    trashContainer.append(trashLabel)
    operationContainer.append(trashContainer)
    signatureContainer.append(operationContainer)
    // 绘图区
    const canvasContainer = document.createElement('div')
    canvasContainer.classList.add(`${PLUGIN_PREFIX}-canvas`)
    const canvas = document.createElement('canvas')
    canvas.width = this.canvasWidth
    canvas.height = this.canvasHeight
    canvas.style.width = `${this.canvasWidth / this.dpr}px`
    canvas.style.height = `${this.canvasHeight / this.dpr}px`
    canvasContainer.append(canvas)
    signatureContainer.append(canvasContainer)
    // 按钮容器
    const menuContainer = document.createElement('div')
    menuContainer.classList.add(`${PLUGIN_PREFIX}-menu`)
    // 取消按钮
    const cancelBtn = document.createElement('button')
    cancelBtn.classList.add(`${PLUGIN_PREFIX}-menu__cancel`)
    cancelBtn.append(document.createTextNode(cancelText))
    cancelBtn.type = 'button'
    cancelBtn.onclick = () => {
      if (onCancel) {
        onCancel()
      }
      this._dispose()
    }
    menuContainer.append(cancelBtn)
    // 确认按钮
    const confirmBtn = document.createElement('button')
    confirmBtn.append(document.createTextNode(confirmText))
    confirmBtn.type = 'submit'
    confirmBtn.onclick = () => {
      if (onConfirm) {
        onConfirm(this._toData())
      }
      this._dispose()
    }
    menuContainer.append(confirmBtn)
    signatureContainer.append(menuContainer)
    // 渲染
    document.body.append(container)
    this.container = container
    this.mask = mask
    return {
      mask,
      canvas,
      container,
      trashContainer,
      undoContainer
    }
  }

  private _bindEvent() {
    this.trashContainer.onclick = this._clearCanvas.bind(this)
    this.undoContainer.onclick = this._undo.bind(this)
    this.canvas.onmousedown = this._startDraw.bind(this)
    this.canvas.onmousemove = this._draw.bind(this)
    this.container.onmouseup = this._stopDraw.bind(this)
    this.container.ontouchmove = this.registerTouchmove.bind(this)
    this.container.ontouchstart = this.registerTouchstart.bind(this)
    this.container.ontouchend = this.registerTouchend.bind(this)
  }

  private _undo() {
    if (this.undoStack.length > 1) {
      this.undoStack.pop()
      if (this.undoStack.length) {
        this.undoStack[this.undoStack.length - 1]()
      }
    }
  }

  private _saveUndoFn(fn: Function) {
    this.undoStack.push(fn)
    while (this.undoStack.length > this.MAX_RECORD_COUNT) {
      this.undoStack.shift()
    }
  }

  private _clearUndoFn() {
    const clearFn = () => {
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    }
    this.undoStack = [clearFn]
  }

  private _clearCanvas() {
    this._clearUndoFn()
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
  }

  private _startDraw(evt: MouseEvent) {
    this.isDrawing = true
    this.x = evt.offsetX
    this.y = evt.offsetY
    this.ctx.lineWidth = 1
    this.strokeList.push([])
  }

  private _draw(evt: MouseEvent) {
    if (!this.isDrawing) return
    // 计算鼠标移动速度
    const curTimestamp = performance.now()
    const distance = Math.sqrt(evt.movementX ** 2 + evt.movementY ** 2)
    const speed = distance / (curTimestamp - this.preTimeStamp)
    // 目标线宽：最小速度1，最大速度5，系数3
    const SPEED_FACTOR = 3
    const targetLineWidth = Math.min(5, Math.max(1, 5 - speed * SPEED_FACTOR))
    // 平滑过渡算法（20%的变化比例）调整线条粗细：系数0.2
    const SMOOTH_FACTOR = 0.2
    this.ctx.lineWidth =
      this.ctx.lineWidth * (1 - SMOOTH_FACTOR) + targetLineWidth * SMOOTH_FACTOR
    // 绘制
    const { offsetX, offsetY } = evt
    this.ctx.beginPath()
    this.ctx.moveTo(this.x, this.y)
    this.ctx.lineTo(offsetX, offsetY)
    this.ctx.stroke()
    this.x = offsetX
    this.y = offsetY
    this.linePoints.push([offsetX, offsetY])
    this.strokeList[this.strokeList.length - 1].push([
      offsetX,
      offsetY,
      this.ctx.lineWidth
    ])
    this.isDrawn = true
    // 缓存之前时间戳
    this.preTimeStamp = curTimestamp
  }

  private _stopDraw() {
    this.isDrawing = false
    if (this.isDrawn) {
      const imageData = this.ctx.getImageData(
        0,
        0,
        this.canvasWidth,
        this.canvasHeight
      )
      const self = this
      this._saveUndoFn(function () {
        self.ctx.clearRect(0, 0, self.canvasWidth, self.canvasHeight)
        self.ctx.putImageData(imageData, 0, 0)
      })
      this.isDrawn = false
    }
  }

  private _toData(): ISignatureResult | null {
    if (!this.linePoints.length) return null
    // 查找矩形四角坐标
    const startX = this.linePoints[0][0]
    const startY = this.linePoints[0][1]
    let minX = startX
    let minY = startY
    let maxX = startX
    let maxY = startY
    for (let p = 0; p < this.linePoints.length; p++) {
      const point = this.linePoints[p]
      if (minX > point[0]) {
        minX = point[0]
      }
      if (maxX < point[0]) {
        maxX = point[0]
      }
      if (minY > point[1]) {
        minY = point[1]
      }
      if (maxY < point[1]) {
        maxY = point[1]
      }
    }
    // 增加边框宽度
    const lineWidth = this.ctx.lineWidth
    minX = minX < lineWidth ? 0 : minX - lineWidth
    minY = minY < lineWidth ? 0 : minY - lineWidth
    maxX = maxX + lineWidth
    maxY = maxY + lineWidth
    const sw = maxX - minX
    const sh = maxY - minY
    const exportType = this.options.exportType || DEFAULT_EXPORT_TYPE
    const value =
      exportType === 'svg'
        ? this._toSvgData(minX, minY, sw, sh)
        : this._toPngData(minX, minY, sw, sh)
    return {
      value,
      width: sw,
      height: sh
    }
  }

  private _toPngData(
    minX: number,
    minY: number,
    sw: number,
    sh: number
  ): string {
    // 裁剪图像
    const imageData = this.ctx.getImageData(
      minX * this.dpr,
      minY * this.dpr,
      sw * this.dpr,
      sh * this.dpr
    )
    const canvas = document.createElement('canvas')
    canvas.style.width = `${sw}px`
    canvas.style.height = `${sh}px`
    canvas.width = sw * this.dpr
    canvas.height = sh * this.dpr
    const ctx = <CanvasRenderingContext2D>canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
  }

  private _toSvgData(
    minX: number,
    minY: number,
    sw: number,
    sh: number
  ): string {
    // 坐标保留两位小数，减小 svg 体积
    const fix = (n: number) => Math.round(n * 100) / 100
    const pathList: string[] = []
    for (const stroke of this.strokeList) {
      if (stroke.length === 1) {
        // 单点笔画渲染为圆点
        const [x, y, w] = stroke[0]
        pathList.push(
          `<circle cx="${fix(x - minX)}" cy="${fix(y - minY)}" r="${fix(
            w / 2
          )}" fill="#000" stroke="none"/>`
        )
        continue
      }
      for (let p = 1; p < stroke.length; p++) {
        const [x1, y1] = stroke[p - 1]
        const [x2, y2, w2] = stroke[p]
        pathList.push(
          `<path d="M${fix(x1 - minX)} ${fix(y1 - minY)}L${fix(
            x2 - minX
          )} ${fix(y2 - minY)}" stroke-width="${fix(w2)}"/>`
        )
      }
    }
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${fix(sw)}" ` +
      `height="${fix(sh)}" viewBox="0 0 ${fix(sw)} ${fix(sh)}">` +
      `<g fill="none" stroke="#000" stroke-linecap="round" ` +
      `stroke-linejoin="round">${pathList.join('')}</g></svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }

  private registerTouchmove(evt: TouchEvent) {
    this.registerTouchEvent(evt, 'mousemove')
  }

  private registerTouchstart(evt: TouchEvent) {
    this.registerTouchEvent(evt, 'mousedown')
  }

  private registerTouchend() {
    const me = new MouseEvent('mouseup', {})
    this.canvas.dispatchEvent(me)
  }

  private registerTouchEvent(evt: TouchEvent, eventName: string) {
    const touch = evt.touches[0]
    const me = new MouseEvent(eventName, {
      clientX: touch.clientX,
      clientY: touch.clientY
    })
    this.canvas.dispatchEvent(me)
  }

  private _dispose() {
    this.mask.remove()
    this.container.remove()
    document.documentElement.classList.remove(
      `${PLUGIN_PREFIX}-overflow-hidden`
    )
    document.body.classList.remove(`${PLUGIN_PREFIX}-overflow-hidden`)
  }
}

export default function signaturePlugin(
  editor: Editor,
  defaultOptions?: ISignatureOptions
) {
  const command = editor.command

  command.executeSignature = (options?: ISignatureOptions) => {
    // 国际化：优先单次调用 locale 配置，其次插件默认 locale 配置，
    // 再次编辑器 locale 配置，回退 zhCN
    const getLang = (): ISignatureLang => {
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
    const mergedOptions: ISignatureOptions = {
      width: options?.width ?? defaultOptions?.width,
      height: options?.height ?? defaultOptions?.height,
      exportType: options?.exportType ?? defaultOptions?.exportType,
      onClose: options?.onClose ?? defaultOptions?.onClose,
      onCancel: options?.onCancel ?? defaultOptions?.onCancel,
      onConfirm: (payload: ISignatureResult | null) => {
        // 如果外部提供了onConfirm回调，则不执行默认的插入逻辑
        const hasExternalOnConfirm =
          options?.onConfirm || defaultOptions?.onConfirm

        if (hasExternalOnConfirm) {
          options?.onConfirm?.(payload)
          defaultOptions?.onConfirm?.(payload)
        } else {
          if (!payload) return
          const { value, width, height } = payload
          if (!value || !width || !height) return
          command.executeInsertElementList([
            {
              value,
              width,
              height,
              type: ElementType.IMAGE
            }
          ])
        }
      }
    }
    new Signature(mergedOptions, getLang())
  }
}
