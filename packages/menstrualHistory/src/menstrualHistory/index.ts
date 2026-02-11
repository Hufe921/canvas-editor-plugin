import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent
} from '@hufe921/canvas-editor'
import './index.css'
import {
  IMenstrualHistoryData,
  IMenstrualHistoryOption
} from './interface/MenstrualHistory'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeLoadMenstrualHistory(option?: IMenstrualHistoryOption): void
  }
}

const PLUGIN_NAME = 'menstrualHistory'

class MenstrualHistory {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private options: IMenstrualHistoryOption
  private inputs: {
    menarcheAge: HTMLInputElement
    menstrualDuration: HTMLInputElement
    menstrualCycle: HTMLInputElement
    lastMenstrualPeriod: HTMLInputElement
  }

  constructor(options?: IMenstrualHistoryOption) {
    this.options = options || {}
    this.inputs = {
      menarcheAge: document.createElement('input'),
      menstrualDuration: document.createElement('input'),
      menstrualCycle: document.createElement('input'),
      lastMenstrualPeriod: document.createElement('input')
    }

    const { mask, container } = this.createDialog()
    this.mask = mask
    this.container = container

    if (this.options.data) {
      this.fillData(this.options.data)
    }
  }

  private createDialog() {
    const mask = document.createElement('div')
    mask.classList.add('menstrual-history-dialog-mask')
    mask.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    mask.onclick = () => {
      this.destroy()
    }
    document.body.append(mask)

    const container = document.createElement('div')
    container.classList.add('menstrual-history-dialog-container')
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)

    const dialog = document.createElement('div')
    dialog.classList.add('menstrual-history-dialog')
    container.append(dialog)

    const titleContainer = document.createElement('div')
    titleContainer.classList.add('menstrual-history-dialog-title')
    dialog.append(titleContainer)

    const titleText = document.createElement('span')
    titleText.classList.add('menstrual-history-dialog-title-text')
    titleText.textContent = '月经史'
    titleContainer.append(titleText)

    const titleClose = document.createElement('i')
    titleClose.classList.add('menstrual-history-dialog-title-close')
    titleClose.onclick = () => {
      this.destroy()
    }
    titleContainer.append(titleClose)

    const mainContainer = document.createElement('div')
    mainContainer.classList.add('menstrual-history-dialog-main')
    dialog.append(mainContainer)

    this.createHorizontalForm(mainContainer)

    const footerContainer = document.createElement('div')
    footerContainer.classList.add('menstrual-history-dialog-footer')
    dialog.append(footerContainer)

    const cancelBtn = document.createElement('button')
    cancelBtn.classList.add(
      'menstrual-history-dialog-btn',
      'menstrual-history-dialog-btn-cancel'
    )
    cancelBtn.textContent = '取消'
    cancelBtn.onclick = () => {
      this.options.onCancel?.()
      this.destroy()
    }
    footerContainer.append(cancelBtn)

    const confirmBtn = document.createElement('button')
    confirmBtn.classList.add(
      'menstrual-history-dialog-btn',
      'menstrual-history-dialog-btn-confirm'
    )
    confirmBtn.textContent = '确定'
    confirmBtn.onclick = () => {
      this.handleConfirm()
    }
    footerContainer.append(confirmBtn)

    document.body.append(container)

    return { mask, container }
  }

  private createHorizontalForm(container: HTMLDivElement) {
    const horizontalContainer = document.createElement('div')
    horizontalContainer.classList.add('menstrual-history-horizontal')
    container.append(horizontalContainer)

    // 左侧 - 初潮年龄
    this.inputs.menarcheAge.classList.add('menstrual-history-input')
    this.inputs.menarcheAge.placeholder = '初潮年龄'
    horizontalContainer.append(this.inputs.menarcheAge)

    // 中间 - 分数形式（经期天/周期天）
    const fractionItem = document.createElement('div')
    fractionItem.classList.add('menstrual-history-fraction')
    horizontalContainer.append(fractionItem)

    this.inputs.menstrualDuration.placeholder = '经期天'
    fractionItem.append(this.inputs.menstrualDuration)

    const line = document.createElement('div')
    line.classList.add('menstrual-history-fraction-line')
    fractionItem.append(line)

    this.inputs.menstrualCycle.placeholder = '周期天'
    fractionItem.append(this.inputs.menstrualCycle)

    // 右侧 - 末次月经日期
    this.inputs.lastMenstrualPeriod.classList.add('menstrual-history-input')
    this.inputs.lastMenstrualPeriod.placeholder = '末次月经或绝经年龄'
    horizontalContainer.append(this.inputs.lastMenstrualPeriod)
  }

  private fillData(data: IMenstrualHistoryData) {
    this.inputs.menarcheAge.value = data.menarcheAge || ''
    this.inputs.menstrualDuration.value = data.menstrualDuration || ''
    this.inputs.menstrualCycle.value = data.menstrualCycle || ''
    this.inputs.lastMenstrualPeriod.value = data.lastMenstrualPeriod || ''
  }

  private getData(): IMenstrualHistoryData {
    return {
      menarcheAge: this.inputs.menarcheAge.value.trim(),
      menstrualDuration: this.inputs.menstrualDuration.value.trim(),
      menstrualCycle: this.inputs.menstrualCycle.value.trim(),
      lastMenstrualPeriod: this.inputs.lastMenstrualPeriod.value.trim()
    }
  }

  private handleConfirm() {
    const data = this.getData()

    const svgResult = this.generateSVG(data)

    this.options.onConfirm?.({
      ...data,
      svg: svgResult.svg,
      width: svgResult.width,
      height: svgResult.height
    })

    this.destroy()
  }

  /**
   * 生成月经史SVG图片
   * 格式：初潮年龄  经期天/周期天  末次月经日期(LMP)或绝经年龄
   */
  private generateSVG(data: IMenstrualHistoryData): {
    svg: string
    width: number
    height: number
  } {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const fontSize = 13
    ctx.font = `${fontSize}px Arial, "Microsoft YaHei", sans-serif`

    // 计算各部分宽度
    const part1Width = ctx.measureText(data.menarcheAge).width
    const part2Width = ctx.measureText(data.menstrualDuration).width
    const part3Width = ctx.measureText(data.menstrualCycle).width
    const part4Width = ctx.measureText(data.lastMenstrualPeriod).width

    const gap = 1
    const fractionWidth = Math.max(part2Width, part3Width, 30)

    // 布局：初潮年龄 | 分数 | 末次月经日期
    const width = part1Width + gap + fractionWidth + gap + part4Width
    const height = 30

    const startX1 = 0
    const startX2 = part1Width + gap
    const startX3 = startX2 + fractionWidth + gap

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <!-- 初潮年龄 -->
      <text x="${startX1}" y="${height / 2 + 4}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="${fontSize}" fill="#333" text-anchor="start">${this.escapeHtml(data.menarcheAge)}</text>
      <!-- 分数横线 -->
      <line x1="${startX2}" y1="${height / 2}" x2="${startX2 + fractionWidth}" y2="${height / 2}" stroke="#333" stroke-width="1"/>
      <!-- 经期天（分子） -->
      <text x="${startX2 + fractionWidth / 2}" y="${height / 2 - 4}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="${fontSize}" fill="#333" text-anchor="middle">${this.escapeHtml(data.menstrualDuration)}</text>
      <!-- 周期天（分母） -->
      <text x="${startX2 + fractionWidth / 2}" y="${height / 2 + 13}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="${fontSize}" fill="#333" text-anchor="middle">${this.escapeHtml(data.menstrualCycle)}</text>
      <!-- 末次月经日期 -->
      <text x="${startX3}" y="${height / 2 + 4}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="${fontSize}" fill="#333" text-anchor="start">${this.escapeHtml(data.lastMenstrualPeriod)}</text>
    </svg>`

    const utf8Bytes = new TextEncoder().encode(svgContent)
    const base64 = btoa(
      Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('')
    )
    return {
      svg: `data:image/svg+xml;base64,${base64}`,
      width: Math.ceil(width),
      height: Math.ceil(height)
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private destroy() {
    this.mask.remove()
    this.container.remove()
  }
}

export default function menstrualHistoryPlugin(editor: Editor) {
  const command = editor.command

  command.executeLoadMenstrualHistory = (
    option: IMenstrualHistoryOption = {}
  ) => {
    new MenstrualHistory(option)
  }
}

export { MenstrualHistory, PLUGIN_NAME }
export type { IMenstrualHistoryData, IMenstrualHistoryOption }
