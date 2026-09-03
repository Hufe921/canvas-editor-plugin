import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  ElementType
} from '@hufe921/canvas-editor'
import type { IElement } from '@hufe921/canvas-editor'
import * as echarts from 'echarts'
import type {
  IChartLang,
  IChartMode,
  IChartOptions,
  IChartType
} from './interface'
import {
  DEFAULT_HEIGHT,
  DEFAULT_LOCALE,
  DEFAULT_SERIES_DATA,
  DEFAULT_WIDTH,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX,
  RENDER_DEBOUNCE_TIME
} from './constant'
import './style'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeChart(options?: IChartOptions): void
  }
}

// 生成元素 id（非安全上下文下 crypto.randomUUID 不可用时降级）
function createUUID(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

class Chart {
  private editor: Editor
  private defaultOptions?: IChartOptions
  private options: IChartOptions
  private lang: IChartLang
  private mask: HTMLDivElement | null = null
  private container: HTMLDivElement | null = null
  private renderContainer: HTMLDivElement | null = null
  private chartInstance: echarts.ECharts | null = null
  private previewImage: HTMLImageElement | null = null
  private previewError: HTMLDivElement | null = null
  private templatePanel: HTMLDivElement | null = null
  private advancedPanel: HTMLDivElement | null = null
  private tabTemplate: HTMLDivElement | null = null
  private tabAdvanced: HTMLDivElement | null = null
  private optionTextarea: HTMLTextAreaElement | null = null
  private jsonErrorTip: HTMLDivElement | null = null
  private typeSelect: HTMLSelectElement | null = null
  private titleInput: HTMLInputElement | null = null
  private categoriesInput: HTMLInputElement | null = null
  private seriesDataInput: HTMLInputElement | null = null
  private mode: IChartMode = 'template'
  // 二次编辑时记录原图元素 id，插入时替换，找不到则退化为光标处插入
  private editElementId: string | null = null
  private renderTimer: number | null = null

  constructor(editor: Editor, defaultOptions?: IChartOptions) {
    this.editor = editor
    this.defaultOptions = defaultOptions
    this.options = this.mergeOptions()
    this.lang = this.getLang()
    // 双击已插入的图表图片进行二次编辑
    editor.eventBus.on('imageDblclick', this.imageDblclickHandler)
    // 右键菜单：编辑图表
    editor.register.contextMenuList([
      {
        name: this.lang.editChart,
        when: payload =>
          payload.startElement === payload.endElement &&
          this.isChartImage(payload.startElement),
        callback: (_command, context) => {
          if (context.startElement) {
            this.edit(context.startElement)
          }
        }
      }
    ])
  }

  private getChartOption(element: IElement | null | undefined): object | null {
    const extension = element?.extension as
      | { chartOption?: object }
      | null
      | undefined
    return extension?.chartOption || null
  }

  private isChartImage(element: IElement | null | undefined): boolean {
    return element?.type === ElementType.IMAGE && !!this.getChartOption(element)
  }

  private imageDblclickHandler = (payload: { element: IElement }) => {
    this.edit(payload.element)
  }

  // 二次编辑：用原图 option 预填（进入高级模式），并记录元素 id 用于替换
  private edit(element: IElement) {
    const chartOption = this.getChartOption(element)
    if (!chartOption) return
    this.execute({ defaultOption: chartOption })
    this.editElementId = element.id || null
  }

  private mergeOptions(options?: IChartOptions): IChartOptions {
    return {
      ...this.defaultOptions,
      ...options,
      lang: {
        ...this.defaultOptions?.lang,
        ...options?.lang
      }
    }
  }

  private getLang(options?: IChartOptions): IChartLang {
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

  private createHeader() {
    const header = document.createElement('div')
    header.classList.add(`${PLUGIN_PREFIX}-header`)
    // 模式切换
    const tabs = document.createElement('div')
    tabs.classList.add(`${PLUGIN_PREFIX}-tabs`)
    this.tabTemplate = document.createElement('div')
    this.tabTemplate.classList.add(`${PLUGIN_PREFIX}-tab`)
    this.tabTemplate.innerText = this.lang.templateMode
    this.tabTemplate.onclick = () => this.switchMode('template')
    this.tabAdvanced = document.createElement('div')
    this.tabAdvanced.classList.add(`${PLUGIN_PREFIX}-tab`)
    this.tabAdvanced.innerText = this.lang.advancedMode
    this.tabAdvanced.onclick = () => this.switchMode('advanced')
    tabs.append(this.tabTemplate, this.tabAdvanced)
    // 关闭按钮
    const close = document.createElement('i')
    close.classList.add(`${PLUGIN_PREFIX}-close`)
    close.innerText = '×'
    close.onclick = () => this.destroy()
    header.append(tabs, close)
    return header
  }

  private createFormItem(labelText: string, control: HTMLElement) {
    const item = document.createElement('div')
    item.classList.add(`${PLUGIN_PREFIX}-form-item`)
    const label = document.createElement('span')
    label.innerText = labelText
    item.append(label, control)
    return item
  }

  private createInput(value: string) {
    const input = document.createElement('input')
    input.value = value
    input.oninput = () => this.scheduleRender()
    return input
  }

  private createTemplatePanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-template`)
    // 图表类型
    this.typeSelect = document.createElement('select')
    const typeList: { value: IChartType; label: string }[] = [
      { value: 'bar', label: this.lang.bar },
      { value: 'line', label: this.lang.line },
      { value: 'pie', label: this.lang.pie }
    ]
    typeList.forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.innerText = item.label
      this.typeSelect!.append(option)
    })
    this.typeSelect.onchange = () => this.scheduleRender()
    panel.append(this.createFormItem(this.lang.chartType, this.typeSelect))
    // 标题
    this.titleInput = this.createInput('')
    panel.append(this.createFormItem(this.lang.titleText, this.titleInput))
    // 类目
    this.categoriesInput = this.createInput(this.lang.defaultCategories)
    panel.append(
      this.createFormItem(this.lang.categories, this.categoriesInput)
    )
    // 数值
    this.seriesDataInput = this.createInput(DEFAULT_SERIES_DATA)
    panel.append(
      this.createFormItem(this.lang.seriesData, this.seriesDataInput)
    )
    return panel
  }

  private createAdvancedPanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-advanced`)
    this.optionTextarea = document.createElement('textarea')
    this.optionTextarea.placeholder = this.lang.optionPlaceholder
    this.optionTextarea.spellcheck = false
    this.optionTextarea.oninput = () => {
      this.hideError()
      this.scheduleRender()
    }
    this.jsonErrorTip = document.createElement('div')
    this.jsonErrorTip.classList.add(`${PLUGIN_PREFIX}-json-error`)
    panel.append(this.optionTextarea, this.jsonErrorTip)
    return panel
  }

  private createPreviewPanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-preview`)
    this.previewImage = document.createElement('img')
    this.previewError = document.createElement('div')
    this.previewError.classList.add(`${PLUGIN_PREFIX}-preview-error`)
    panel.append(this.previewImage, this.previewError)
    return panel
  }

  private createFooter() {
    const footer = document.createElement('div')
    footer.classList.add(`${PLUGIN_PREFIX}-footer`)
    const cancelBtn = document.createElement('button')
    cancelBtn.innerText = this.lang.cancel
    cancelBtn.onclick = () => this.destroy()
    const insertBtn = document.createElement('button')
    insertBtn.classList.add(`${PLUGIN_PREFIX}-insert`)
    insertBtn.innerText = this.lang.insert
    insertBtn.onclick = () => this.confirmInsert()
    footer.append(cancelBtn, insertBtn)
    return footer
  }

  private open() {
    // 遮罩层（点击不关闭，防止误触丢失配置）
    const mask = document.createElement('div')
    mask.classList.add(`${PLUGIN_PREFIX}-mask`)
    mask.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    document.body.append(mask)
    this.mask = mask
    // 容器
    const container = document.createElement('div')
    container.classList.add(`${PLUGIN_PREFIX}-container`)
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    // 弹窗
    const dialog = document.createElement('div')
    dialog.classList.add(`${PLUGIN_PREFIX}-dialog`)
    container.append(dialog)
    dialog.append(this.createHeader())
    // 正文：配置区 + 预览区
    const main = document.createElement('div')
    main.classList.add(`${PLUGIN_PREFIX}-main`)
    this.templatePanel = this.createTemplatePanel()
    this.advancedPanel = this.createAdvancedPanel()
    main.append(this.templatePanel, this.advancedPanel)
    main.append(this.createPreviewPanel())
    dialog.append(main)
    dialog.append(this.createFooter())
    document.body.append(container)
    this.container = container
    // 隐藏渲染容器：echarts 在此渲染，用于预览与导出图片
    const renderContainer = document.createElement('div')
    renderContainer.classList.add(`${PLUGIN_PREFIX}-render`)
    document.body.append(renderContainer)
    this.renderContainer = renderContainer
    this.chartInstance = echarts.init(renderContainer, undefined, {
      width: this.options.width || DEFAULT_WIDTH,
      height: this.options.height || DEFAULT_HEIGHT
    })
    // 预填：有 defaultOption 时进入高级模式
    if (this.options.defaultOption) {
      this.optionTextarea!.value = JSON.stringify(
        this.options.defaultOption,
        null,
        2
      )
      this.setMode('advanced')
    } else {
      this.setMode('template')
    }
  }

  private setMode(mode: IChartMode) {
    this.mode = mode
    const isTemplate = mode === 'template'
    this.templatePanel!.style.display = isTemplate ? '' : 'none'
    this.advancedPanel!.style.display = isTemplate ? 'none' : ''
    this.tabTemplate!.classList.toggle('active', isTemplate)
    this.tabAdvanced!.classList.toggle('active', !isTemplate)
    this.hideError()
    this.renderPreview()
  }

  private switchMode(mode: IChartMode) {
    if (mode === this.mode) return
    if (mode === 'advanced') {
      // 模板 -> 高级：带入构建好的 option
      this.optionTextarea!.value = JSON.stringify(
        this.buildTemplateOption(),
        null,
        2
      )
    } else {
      // 高级 -> 模板：尝试回填表单，解析失败则忽略
      try {
        this.backfillTemplate(JSON.parse(this.optionTextarea!.value))
      } catch {
        // 保留模板原有状态
      }
    }
    this.setMode(mode)
  }

  private buildTemplateOption(): echarts.EChartsOption {
    const type = (this.typeSelect!.value || 'bar') as IChartType
    const title = this.titleInput!.value.trim()
    const categories = this.categoriesInput!.value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
    const data = this.seriesDataInput!.value
      .split(',')
      .map(item => Number(item.trim()))
      .filter(num => !Number.isNaN(num))
    if (type === 'pie') {
      return {
        title: { text: title },
        tooltip: {},
        series: [
          {
            type: 'pie',
            radius: '60%',
            data: categories.map((name, i) => ({ name, value: data[i] ?? 0 }))
          }
        ]
      }
    }
    return {
      title: { text: title },
      tooltip: {},
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value' },
      series: [{ type, data }]
    }
  }

  private backfillTemplate(option: any) {
    if (!option || typeof option !== 'object') return
    const series = Array.isArray(option.series) ? option.series[0] : null
    const type = series?.type
    if (type === 'bar' || type === 'line' || type === 'pie') {
      this.typeSelect!.value = type
    }
    if (typeof option.title?.text === 'string') {
      this.titleInput!.value = option.title.text
    }
    if (type === 'pie' && Array.isArray(series?.data)) {
      // 饼图：类目与数值取自系列数据
      this.categoriesInput!.value = series.data
        .map((item: any) => item?.name ?? '')
        .join(',')
      this.seriesDataInput!.value = series.data
        .map((item: any) => item?.value ?? '')
        .join(',')
    } else {
      const xAxis = Array.isArray(option.xAxis)
        ? option.xAxis[0]
        : option.xAxis
      if (Array.isArray(xAxis?.data)) {
        this.categoriesInput!.value = xAxis.data.join(',')
      }
      if (Array.isArray(series?.data)) {
        this.seriesDataInput!.value = series.data.join(',')
      }
    }
  }

  private getCurrentOption(): echarts.EChartsOption {
    if (this.mode === 'template') return this.buildTemplateOption()
    return JSON.parse(this.optionTextarea!.value)
  }

  private scheduleRender() {
    if (this.renderTimer) {
      window.clearTimeout(this.renderTimer)
    }
    this.renderTimer = window.setTimeout(
      () => this.renderPreview(),
      RENDER_DEBOUNCE_TIME
    )
  }

  private renderPreview() {
    if (!this.chartInstance) return
    let option: echarts.EChartsOption
    try {
      option = this.getCurrentOption()
    } catch {
      // JSON 解析失败：显示错误文案，保留上一次预览
      this.showError()
      return
    }
    this.hideError()
    // 导出静态图片无需动画：系列重建/首次渲染会从头播放入场动画，
    // getDataURL 截取到动画起始帧时图形不可见，故强制关闭动画
    this.chartInstance.setOption({ ...option, animation: false }, true)
    this.previewImage!.src = this.chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    })
  }

  private showError() {
    this.previewError!.innerText = this.lang.invalidJson
    this.previewError!.style.display = ''
    if (this.mode === 'advanced') {
      this.jsonErrorTip!.innerText = this.lang.invalidJson
      this.jsonErrorTip!.style.display = ''
    }
  }

  private hideError() {
    if (this.previewError) {
      this.previewError.style.display = 'none'
    }
    if (this.jsonErrorTip) {
      this.jsonErrorTip.style.display = 'none'
    }
  }

  private confirmInsert() {
    if (!this.chartInstance) return
    let option: echarts.EChartsOption
    try {
      option = this.getCurrentOption()
    } catch {
      this.showError()
      return
    }
    // 以最新 option 重新渲染后导出，避免防抖间隙拿到旧图
    this.chartInstance.setOption({ ...option, animation: false }, true)
    const dataURL = this.chartInstance.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    })
    const width = this.options.width || DEFAULT_WIDTH
    const height = this.options.height || DEFAULT_HEIGHT
    const command = this.editor.command
    // 二次编辑：按 id 原位更新旧图（getValue 返回值不含 id，
    // 需通过 getElementById 确认原图仍存在）
    if (
      this.editElementId &&
      command.getElementById({ id: this.editElementId }).length
    ) {
      command.executeUpdateElementById({
        id: this.editElementId,
        properties: {
          value: dataURL,
          width,
          height,
          extension: { chartOption: option }
        }
      })
      this.options.onInsert?.(option)
      this.destroy()
      return
    }
    const element: IElement = {
      // 生成 id 供二次编辑定位
      id: createUUID(),
      type: ElementType.IMAGE,
      value: dataURL,
      width,
      height,
      // 双击进入图表编辑，禁用编辑器内置图片预览
      imgPreviewDisabled: true,
      extension: { chartOption: option }
    }
    command.executeInsertElementList([element])
    this.options.onInsert?.(option)
    this.destroy()
  }

  private destroy() {
    if (this.renderTimer) {
      window.clearTimeout(this.renderTimer)
      this.renderTimer = null
    }
    this.chartInstance?.dispose()
    this.chartInstance = null
    this.mask?.remove()
    this.container?.remove()
    this.renderContainer?.remove()
    this.mask = null
    this.container = null
    this.renderContainer = null
    this.editElementId = null
  }

  public execute(options?: IChartOptions) {
    this.options = this.mergeOptions(options)
    this.lang = this.getLang(options)
    // 重复调用时先销毁已存在弹窗再重建
    this.destroy()
    this.open()
  }
}

export default function chartPlugin(
  editor: Editor,
  defaultOptions?: IChartOptions
) {
  const command = editor.command
  const chart = new Chart(editor, defaultOptions)

  command.executeChart = (options?: IChartOptions) => {
    chart.execute(options)
  }
}
