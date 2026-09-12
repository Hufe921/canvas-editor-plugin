import {
  Editor,
  EDITOR_COMPONENT,
  EditorComponent,
  ElementType
} from '@hufe921/canvas-editor'
import type { IElement } from '@hufe921/canvas-editor'
import type {
  ITemperatureChartLang,
  ITemperatureChartOptions,
  ITemperatureChartOrientation,
  ITemperatureChartData,
  IVitalRecord
} from './interface'
import { renderTemperatureChart } from './renderer'
import {
  DEFAULT_DATA,
  DEFAULT_LOCALE,
  DEFAULT_PORTRAIT_WIDTH,
  DEFAULT_WIDTH,
  DAY_COUNT,
  PLUGIN_LANG_MAP,
  PLUGIN_PREFIX,
  RENDER_DEBOUNCE_TIME,
  TIME_SLOTS
} from './constant'
import './style'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeTemperatureChart(options?: ITemperatureChartOptions): void
  }
}

// 生成元素 id（非安全上下文下 crypto.randomUUID 不可用时降级）
function createUUID(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

// 数据模型均为 JSON 安全结构，用 JSON 深拷贝兼容旧环境
function deepClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

// 模板模式下单个时间档的编辑态（字符串便于清空与容错）
interface IEditSlot {
  temperature: string
  pulse: string
  respiration: string
  pain: string
}

interface IEditDay {
  slots: IEditSlot[]
}

function createEmptyDay(): IEditDay {
  return {
    slots: TIME_SLOTS.map(() => ({
      temperature: '',
      pulse: '',
      respiration: '',
      pain: ''
    }))
  }
}

class TemperatureChart {
  private editor: Editor
  private defaultOptions?: ITemperatureChartOptions
  private options: ITemperatureChartOptions
  private lang: ITemperatureChartLang
  private mask: HTMLDivElement | null = null
  private container: HTMLDivElement | null = null
  private previewImage: HTMLImageElement | null = null
  private previewError: HTMLDivElement | null = null
  private templatePanel: HTMLDivElement | null = null
  private advancedPanel: HTMLDivElement | null = null
  private tabTemplate: HTMLDivElement | null = null
  private tabAdvanced: HTMLDivElement | null = null
  private optionTextarea: HTMLTextAreaElement | null = null
  private jsonErrorTip: HTMLDivElement | null = null
  private patientInputs: Record<string, HTMLInputElement> = {}
  // 按天录入：当前选中的天 + 天切换标签 + 当天护理数据输入
  private selectedDay = 0
  private dayBar: HTMLDivElement | null = null
  private bottomDayInputs: Record<string, HTMLInputElement> = {}
  private bottomDayHint: HTMLSpanElement | null = null
  private vitalsTableBody: HTMLTableSectionElement | null = null
  // 事件标注行容器
  private eventRows: HTMLDivElement | null = null
  // 预览缩放
  private zoomLabel: HTMLSpanElement | null = null
  // 插入方向：横向（原始）/ 竖向（旋转 90°）
  private orientation: ITemperatureChartOrientation = 'landscape'
  private mode: 'template' | 'advanced' = 'template'
  // 模板模式编辑态：按天组织的生命体征
  private editDays: IEditDay[] = []
  // 二次编辑时记录原图元素 id，插入时替换，找不到则退化为光标处插入
  private editElementId: string | null = null
  private renderTimer: number | null = null

  constructor(editor: Editor, defaultOptions?: ITemperatureChartOptions) {
    this.editor = editor
    this.defaultOptions = defaultOptions
    this.options = this.mergeOptions()
    this.lang = this.getLang()
    // 双击已插入的体温单图片进行二次编辑
    editor.eventBus.on('imageDblclick', this.imageDblclickHandler)
    // 右键菜单：编辑体温单
    editor.register.contextMenuList([
      {
        name: this.lang.editChart,
        when: payload =>
          payload.startElement === payload.endElement &&
          this.isTemperatureImage(payload.startElement),
        callback: (_command, context) => {
          if (context.startElement) {
            this.edit(context.startElement)
          }
        }
      }
    ])
  }

  private getSheetData(
    element: IElement | null | undefined
  ): ITemperatureChartData | null {
    const extension = element?.extension as
      | { temperatureChartData?: ITemperatureChartData }
      | null
      | undefined
    return extension?.temperatureChartData || null
  }

  private isTemperatureImage(element: IElement | null | undefined): boolean {
    return element?.type === ElementType.IMAGE && !!this.getSheetData(element)
  }

  private imageDblclickHandler = (payload: { element: IElement }) => {
    this.edit(payload.element)
  }

  // 二次编辑：用原图数据预填，并记录元素 id 用于替换
  private edit(element: IElement) {
    const data = this.getSheetData(element)
    if (!data) return
    this.execute({ defaultData: data })
    this.editElementId = element.id || null
  }

  private mergeOptions(
    options?: ITemperatureChartOptions
  ): ITemperatureChartOptions {
    return {
      ...this.defaultOptions,
      ...options,
      lang: {
        ...this.defaultOptions?.lang,
        ...options?.lang
      }
    }
  }

  private getLang(options?: ITemperatureChartOptions): ITemperatureChartLang {
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
    // 标题与关闭按钮
    const title = document.createElement('span')
    title.classList.add(`${PLUGIN_PREFIX}-title`)
    title.innerText = this.lang.title
    const close = document.createElement('i')
    close.classList.add(`${PLUGIN_PREFIX}-close`)
    close.innerText = '×'
    close.onclick = () => this.destroy()
    header.append(tabs, title, close)
    return header
  }

  private createSectionTitle(text: string) {
    const sectionTitle = document.createElement('div')
    sectionTitle.classList.add(`${PLUGIN_PREFIX}-section-title`)
    sectionTitle.innerText = text
    return sectionTitle
  }

  private createPatientPanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-patient`)
    panel.append(this.createSectionTitle(this.lang.patientInfo))
    const grid = document.createElement('div')
    grid.classList.add(`${PLUGIN_PREFIX}-form-grid`)
    const fields: { key: string; label: string }[] = [
      { key: 'name', label: this.lang.name },
      { key: 'gender', label: this.lang.gender },
      { key: 'age', label: this.lang.age },
      { key: 'department', label: this.lang.department },
      { key: 'bed', label: this.lang.bed },
      { key: 'admissionDate', label: this.lang.admissionDate },
      { key: 'hospitalNumber', label: this.lang.hospitalNumber },
      { key: 'surgeryDate', label: this.lang.surgeryDate }
    ]
    fields.forEach(({ key, label }) => {
      const item = document.createElement('div')
      item.classList.add(`${PLUGIN_PREFIX}-form-item`)
      const labelEl = document.createElement('span')
      labelEl.innerText = label
      const input = document.createElement('input')
      // 手术日期属于顶层字段，其余均为患者信息字段
      const isSurgery = key === 'surgeryDate'
      const patient = this.currentData.patient as unknown as Record<
        string,
        string
      >
      const initial = isSurgery ? this.currentData.surgeryDate : patient[key]
      input.value = initial == null ? '' : `${initial}`
      input.oninput = () => {
        const value = input.value.trim()
        if (isSurgery) {
          this.currentData.surgeryDate = value || undefined
        } else {
          patient[key] = value
        }
        this.scheduleRender()
      }
      this.patientInputs[key] = input
      item.append(labelEl, input)
      grid.append(item)
    })
    panel.append(grid)
    return panel
  }

  // 生命体征编辑表：按天录入，行 = 指标，列 = 2/6/10/14/18/22 时
  private createVitalsTable() {
    const table = document.createElement('table')
    table.classList.add(`${PLUGIN_PREFIX}-vitals-table`)
    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    const indicatorHead = document.createElement('th')
    indicatorHead.innerText = this.lang.indicator
    headRow.append(indicatorHead)
    this.lang.slotLabels.forEach(label => {
      const th = document.createElement('th')
      th.innerText = label
      headRow.append(th)
    })
    thead.append(headRow)
    table.append(thead)
    this.vitalsTableBody = document.createElement('tbody')
    table.append(this.vitalsTableBody)
    this.rebuildVitalsRows()
    return table
  }

  private rebuildVitalsRows() {
    const tbody = this.vitalsTableBody!
    tbody.innerHTML = ''
    const day = this.editDays[this.selectedDay]
    if (!day) return
    const indicators: { key: keyof IEditSlot; label: string }[] = [
      { key: 'temperature', label: this.lang.temperature },
      { key: 'pulse', label: this.lang.pulse },
      { key: 'respiration', label: this.lang.respiration },
      { key: 'pain', label: this.lang.pain }
    ]
    indicators.forEach(indicator => {
      const tr = document.createElement('tr')
      const indicatorCell = document.createElement('td')
      indicatorCell.classList.add(`${PLUGIN_PREFIX}-indicator-cell`)
      indicatorCell.innerText = indicator.label
      tr.append(indicatorCell)
      day.slots.forEach((slot, slotIndex) => {
        const cell = document.createElement('td')
        const input = document.createElement('input')
        input.value = slot[indicator.key]
        input.oninput = () => {
          this.editDays[this.selectedDay].slots[slotIndex][indicator.key] =
            input.value.trim()
          this.scheduleRender()
        }
        cell.append(input)
        tr.append(cell)
      })
      tbody.append(tr)
    })
  }

  // 天切换标签：数字 + 有数据圆点，尾部带添加/删除
  private rebuildDayBar() {
    const bar = this.dayBar!
    bar.innerHTML = ''
    this.editDays.forEach((day, index) => {
      const tab = document.createElement('div')
      tab.classList.add(`${PLUGIN_PREFIX}-day-tab`)
      if (index === this.selectedDay) {
        tab.classList.add('active')
      }
      const hasData = day.slots.some(
        slot =>
          slot.temperature !== '' ||
          slot.pulse !== '' ||
          slot.respiration !== '' ||
          slot.pain !== ''
      )
      if (hasData) {
        tab.classList.add('has-data')
      }
      tab.innerText = `${index + 1}`
      tab.title = this.lang.dayLabel.replace('{n}', `${index + 1}`)
      tab.onclick = () => {
        if (this.selectedDay === index) return
        this.selectedDay = index
        this.rebuildDayBar()
        this.rebuildVitalsRows()
        this.refreshBottomInputs()
      }
      bar.append(tab)
    })
    const addBtn = document.createElement('div')
    addBtn.classList.add(
      `${PLUGIN_PREFIX}-day-tab`,
      `${PLUGIN_PREFIX}-day-tab-add`
    )
    addBtn.innerText = '+'
    addBtn.title = this.lang.addDay
    addBtn.onclick = () => {
      if (this.editDays.length >= DAY_COUNT) return
      this.editDays.push(createEmptyDay())
      this.selectedDay = this.editDays.length - 1
      this.rebuildDayBar()
      this.rebuildVitalsRows()
      this.refreshBottomInputs()
    }
    bar.append(addBtn)
    if (this.editDays.length > 1) {
      const removeBtn = document.createElement('div')
      removeBtn.classList.add(
        `${PLUGIN_PREFIX}-day-tab`,
        `${PLUGIN_PREFIX}-day-tab-remove`
      )
      removeBtn.innerText = '−'
      removeBtn.title = this.lang.removeDay
      removeBtn.onclick = () => {
        this.editDays.splice(this.selectedDay, 1)
        this.selectedDay = Math.max(0, this.selectedDay - 1)
        this.rebuildDayBar()
        this.rebuildVitalsRows()
        this.refreshBottomInputs()
        this.scheduleRender()
      }
      bar.append(removeBtn)
    }
  }

  private createVitalsPanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-vitals`)
    panel.append(this.createSectionTitle(this.lang.vitalData))
    this.dayBar = document.createElement('div')
    this.dayBar.classList.add(`${PLUGIN_PREFIX}-day-bar`)
    this.rebuildDayBar()
    panel.append(this.dayBar)
    panel.append(this.createVitalsTable())
    return panel
  }

  // 事件标注（40℃ 线上方红字竖排事件）：每行 = 天 + 时间档 + 事件名 + 时间
  private createEventsPanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-events`)
    panel.append(this.createSectionTitle(this.lang.eventData))
    this.eventRows = document.createElement('div')
    this.eventRows.classList.add(`${PLUGIN_PREFIX}-event-rows`)
    panel.append(this.eventRows)
    this.rebuildEventRows()
    const addBtn = document.createElement('button')
    addBtn.classList.add(`${PLUGIN_PREFIX}-event-add`)
    addBtn.innerText = `+ ${this.lang.addEvent}`
    addBtn.onclick = () => {
      const events = this.currentData.events || (this.currentData.events = [])
      events.push({ dayIndex: this.selectedDay, slot: 2, label: '', time: '' })
      this.rebuildEventRows()
    }
    panel.append(addBtn)
    return panel
  }

  private rebuildEventRows() {
    const container = this.eventRows
    if (!container) return
    container.innerHTML = ''
    const events = this.currentData.events || []
    events.forEach((event, index) => {
      const row = document.createElement('div')
      row.classList.add(`${PLUGIN_PREFIX}-event-row`)
      // 天（1-7）
      const daySelect = document.createElement('select')
      for (let day = 0; day < DAY_COUNT; day++) {
        const option = document.createElement('option')
        option.value = `${day}`
        option.innerText = this.lang.dayLabel.replace('{n}', `${day + 1}`)
        daySelect.append(option)
      }
      daySelect.value = `${event.dayIndex}`
      daySelect.onchange = () => {
        event.dayIndex = Number(daySelect.value)
        this.scheduleRender()
      }
      // 时间档（2/6/10/14/18/22 时）
      const slotSelect = document.createElement('select')
      this.lang.slotLabels.forEach((label, slot) => {
        const option = document.createElement('option')
        option.value = `${slot}`
        option.innerText = label
        slotSelect.append(option)
      })
      slotSelect.value = `${event.slot}`
      slotSelect.onchange = () => {
        event.slot = Number(slotSelect.value)
        this.scheduleRender()
      }
      // 事件名（如：入院日期、手术、出院）
      const labelInput = document.createElement('input')
      labelInput.value = event.label
      labelInput.placeholder = this.lang.eventName
      labelInput.oninput = () => {
        event.label = labelInput.value.trim()
        this.scheduleRender()
      }
      // 事件时间（如：09:30）
      const timeInput = document.createElement('input')
      timeInput.value = event.time || ''
      timeInput.placeholder = this.lang.eventTime
      timeInput.oninput = () => {
        event.time = timeInput.value.trim()
        this.scheduleRender()
      }
      // 删除该行
      const removeBtn = document.createElement('i')
      removeBtn.classList.add(`${PLUGIN_PREFIX}-event-remove`)
      removeBtn.innerText = '×'
      removeBtn.onclick = () => {
        events.splice(index, 1)
        this.rebuildEventRows()
        this.scheduleRender()
      }
      row.append(daySelect, slotSelect, labelInput, timeInput, removeBtn)
      container.append(row)
    })
  }

  // 护理数据：跟随天切换标签，仅编辑当天
  private createBottomPanel() {
    const panel = document.createElement('div')
    panel.classList.add(`${PLUGIN_PREFIX}-bottom-data`)
    const title = this.createSectionTitle(this.lang.bottomData)
    this.bottomDayHint = document.createElement('span')
    this.bottomDayHint.classList.add(`${PLUGIN_PREFIX}-day-hint`)
    title.append(this.bottomDayHint)
    panel.append(title)
    const grid = document.createElement('div')
    grid.classList.add(`${PLUGIN_PREFIX}-form-grid`)
    const rows: {
      key: keyof ITemperatureChartData['bottom']
      label: string
    }[] = [
      { key: 'stool', label: this.lang.stool },
      { key: 'urine', label: this.lang.urine },
      { key: 'output', label: this.lang.output },
      { key: 'intake', label: this.lang.intake },
      { key: 'bloodPressure', label: this.lang.bloodPressure },
      { key: 'weight', label: this.lang.weight },
      { key: 'height', label: this.lang.height },
      { key: 'drainage', label: this.lang.drainage },
      { key: 'allergy', label: this.lang.allergy }
    ]
    rows.forEach(({ key, label }) => {
      const item = document.createElement('div')
      item.classList.add(`${PLUGIN_PREFIX}-form-item`)
      const labelEl = document.createElement('span')
      labelEl.innerText = label
      const input = document.createElement('input')
      input.oninput = () => {
        const bottom = this.currentData.bottom as Record<
          string,
          Record<number, string>
        >
        let record = bottom[key as string]
        if (!record) {
          record = {}
          bottom[key as string] = record
        }
        const value = input.value.trim()
        if (value === '') {
          delete record[this.selectedDay]
        } else {
          record[this.selectedDay] = value
        }
        this.scheduleRender()
      }
      this.bottomDayInputs[key as string] = input
      item.append(labelEl, input)
      grid.append(item)
    })
    panel.append(grid)
    this.refreshBottomInputs()
    return panel
  }

  // 切天时刷新护理数据输入框与“第N天”提示
  private refreshBottomInputs() {
    const bottom = this.currentData.bottom as Record<
      string,
      Record<number, string>
    >
    Object.entries(this.bottomDayInputs).forEach(([key, input]) => {
      const record = bottom[key] || {}
      const value = record[this.selectedDay]
      input.value = value == null ? '' : `${value}`
    })
    if (this.bottomDayHint) {
      this.bottomDayHint.innerText = this.lang.dayLabel.replace(
        '{n}',
        `${this.selectedDay + 1}`
      )
    }
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
    // 缩放工具栏：缩小 / 放大 / 原始大小 / 适应宽度
    const toolbar = document.createElement('div')
    toolbar.classList.add(`${PLUGIN_PREFIX}-preview-toolbar`)
    const createZoomButton = (text: string, onClick: () => void) => {
      const button = document.createElement('button')
      button.innerText = text
      button.onclick = onClick
      return button
    }
    const zoomOut = createZoomButton('－', () => this.zoomBy(1 / 1.25))
    const zoomIn = createZoomButton('＋', () => this.zoomBy(1.25))
    const actual = createZoomButton('100%', () => this.setZoomActual())
    const fit = createZoomButton(this.lang.fitPreview, () => this.setZoomFit())
    this.zoomLabel = document.createElement('span')
    this.zoomLabel.classList.add(`${PLUGIN_PREFIX}-preview-zoom`)
    toolbar.append(zoomOut, zoomIn, actual, fit, this.zoomLabel)
    // 预览主体：可滚动，图片居中展示
    const body = document.createElement('div')
    body.classList.add(`${PLUGIN_PREFIX}-preview-body`)
    this.previewImage = document.createElement('img')
    // 图片加载完成后刷新缩放百分比显示
    this.previewImage.onload = () => this.updateZoomLabel()
    this.previewError = document.createElement('div')
    this.previewError.classList.add(`${PLUGIN_PREFIX}-preview-error`)
    body.append(this.previewImage, this.previewError)
    panel.append(toolbar, body)
    return panel
  }

  private zoomBy(factor: number) {
    const img = this.previewImage!
    if (!img.naturalWidth) return
    // SVG 的 naturalWidth 即逻辑宽度，矢量缩放不失真
    const current = img.getBoundingClientRect().width || img.naturalWidth
    const next = Math.min(Math.max(current * factor, 200), img.naturalWidth * 3)
    img.style.width = `${Math.round(next)}px`
    this.updateZoomLabel()
  }

  private setZoomActual() {
    const img = this.previewImage!
    if (!img.naturalWidth) return
    img.style.width = `${img.naturalWidth}px`
    this.updateZoomLabel()
  }

  private setZoomFit() {
    this.previewImage!.style.width = ''
    this.updateZoomLabel()
  }

  private updateZoomLabel() {
    const img = this.previewImage
    if (!img || !this.zoomLabel || !img.naturalWidth) return
    if (!img.style.width) {
      this.zoomLabel.innerText = this.lang.fitPreview
      return
    }
    const percent = Math.round(
      (img.getBoundingClientRect().width / img.naturalWidth) * 100
    )
    this.zoomLabel.innerText = `${percent}%`
  }

  private createFooter() {
    const footer = document.createElement('div')
    footer.classList.add(`${PLUGIN_PREFIX}-footer`)
    // 插入方向切换（左对齐）
    const orientationGroup = document.createElement('div')
    orientationGroup.classList.add(`${PLUGIN_PREFIX}-orientation`)
    const landscapeBtn = document.createElement('button')
    landscapeBtn.type = 'button'
    landscapeBtn.innerText = this.lang.landscape
    const portraitBtn = document.createElement('button')
    portraitBtn.type = 'button'
    portraitBtn.innerText = this.lang.portrait
    const updateOrientationButtons = () => {
      landscapeBtn.classList.toggle('active', this.orientation === 'landscape')
      portraitBtn.classList.toggle('active', this.orientation === 'portrait')
    }
    landscapeBtn.onclick = () => {
      if (this.orientation === 'landscape') return
      this.orientation = 'landscape'
      updateOrientationButtons()
      this.renderPreview()
    }
    portraitBtn.onclick = () => {
      if (this.orientation === 'portrait') return
      this.orientation = 'portrait'
      updateOrientationButtons()
      this.renderPreview()
    }
    updateOrientationButtons()
    orientationGroup.append(landscapeBtn, portraitBtn)
    footer.append(orientationGroup)
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

  // 当前数据：模板模式从表单状态合成，高级模式解析 JSON
  private currentData: ITemperatureChartData = deepClone(DEFAULT_DATA)

  private buildTemplateData(): ITemperatureChartData {
    const vitals: IVitalRecord[] = []
    this.editDays.forEach((day, dayIndex) => {
      day.slots.forEach((slot, slotIndex) => {
        const record: IVitalRecord = { dayIndex, slot: slotIndex }
        const temperature = Number(slot.temperature)
        if (slot.temperature !== '' && !Number.isNaN(temperature)) {
          record.temperature = temperature
        }
        const pulse = Number(slot.pulse)
        if (slot.pulse !== '' && !Number.isNaN(pulse)) {
          record.pulse = pulse
        }
        const respiration = Number(slot.respiration)
        if (slot.respiration !== '' && !Number.isNaN(respiration)) {
          record.respiration = respiration
        }
        const pain = Number(slot.pain)
        if (slot.pain !== '' && !Number.isNaN(pain)) {
          record.pain = pain
        }
        if (
          record.temperature != null ||
          record.pulse != null ||
          record.respiration != null ||
          record.pain != null
        ) {
          vitals.push(record)
        }
      })
    })
    return {
      ...deepClone(this.currentData),
      vitals,
      // 未填写事件名的行不参与绘制
      events: (this.currentData.events || []).filter(event => event.label)
    }
  }

  // 数据 -> 模板编辑态（高级模式回切、defaultData 预填共用）
  private backfillTemplate(data: ITemperatureChartData) {
    this.currentData = deepClone({
      ...DEFAULT_DATA,
      ...data,
      patient: { ...DEFAULT_DATA.patient, ...data.patient },
      bottom: { ...data.bottom }
    })
    // 回填患者信息输入框
    Object.entries(this.patientInputs).forEach(([key, input]) => {
      const value = (this.currentData.patient as any)[key]
      input.value = value == null ? '' : `${value}`
    })
    // 生命体征：按天重组，末尾补一个空白天便于续录
    const maxDay = data.vitals.reduce(
      (max, record) => Math.max(max, record.dayIndex),
      -1
    )
    const dayCount = Math.min(maxDay + 2, DAY_COUNT)
    this.editDays = []
    for (let day = 0; day < dayCount; day++) {
      this.editDays.push(createEmptyDay())
    }
    data.vitals.forEach(record => {
      if (record.dayIndex < 0 || record.dayIndex >= this.editDays.length) return
      if (record.slot < 0 || record.slot >= TIME_SLOTS.length) return
      const slot = this.editDays[record.dayIndex].slots[record.slot]
      if (record.temperature != null) {
        slot.temperature = `${record.temperature}`
      }
      if (record.pulse != null) {
        slot.pulse = `${record.pulse}`
      }
      if (record.respiration != null) {
        slot.respiration = `${record.respiration}`
      }
      if (record.pain != null) {
        slot.pain = `${record.pain}`
      }
    })
    this.selectedDay = 0
    if (this.dayBar) {
      this.rebuildDayBar()
    }
    if (this.vitalsTableBody) {
      this.rebuildVitalsRows()
    }
    // 回填事件标注行
    this.rebuildEventRows()
    // 回填当天护理数据输入框
    this.refreshBottomInputs()
  }

  private getCurrentData(): ITemperatureChartData | null {
    if (this.mode === 'template') return this.buildTemplateData()
    try {
      const parsed = JSON.parse(this.optionTextarea!.value)
      if (!parsed || typeof parsed !== 'object') return null
      return parsed as ITemperatureChartData
    } catch {
      return null
    }
  }

  private setMode(mode: 'template' | 'advanced') {
    this.mode = mode
    const isTemplate = mode === 'template'
    this.templatePanel!.style.display = isTemplate ? '' : 'none'
    this.advancedPanel!.style.display = isTemplate ? 'none' : ''
    this.tabTemplate!.classList.toggle('active', isTemplate)
    this.tabAdvanced!.classList.toggle('active', !isTemplate)
    this.hideError()
    this.renderPreview()
  }

  private switchMode(mode: 'template' | 'advanced') {
    if (mode === this.mode) return
    if (mode === 'advanced') {
      // 模板 -> 高级：带入合成后的完整数据
      this.optionTextarea!.value = JSON.stringify(
        this.buildTemplateData(),
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
    const configColumn = document.createElement('div')
    configColumn.classList.add(`${PLUGIN_PREFIX}-config`)
    this.templatePanel = document.createElement('div')
    this.templatePanel.classList.add(`${PLUGIN_PREFIX}-template`)
    this.templatePanel.append(
      this.createPatientPanel(),
      this.createVitalsPanel(),
      this.createEventsPanel(),
      this.createBottomPanel()
    )
    this.advancedPanel = this.createAdvancedPanel()
    configColumn.append(this.templatePanel, this.advancedPanel)
    main.append(configColumn, this.createPreviewPanel())
    dialog.append(main)
    dialog.append(this.createFooter())
    document.body.append(container)
    this.container = container
    // 预填：defaultData 直接进入高级模式（可携带模板未覆盖字段），
    // 无 defaultData 时以示例数据回填模板模式
    if (this.options.defaultData) {
      this.backfillTemplate(this.options.defaultData)
      this.optionTextarea!.value = JSON.stringify(
        this.options.defaultData,
        null,
        2
      )
      this.setMode('advanced')
    } else {
      this.backfillTemplate(DEFAULT_DATA)
      this.setMode('template')
    }
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
    const data = this.getCurrentData()
    if (!data) {
      this.showError()
      return
    }
    this.hideError()
    const result = renderTemperatureChart(data, {
      orientation: this.orientation
    })
    this.previewImage!.src = result.dataURL
    this.updateZoomLabel()
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
    const data = this.getCurrentData()
    if (!data) {
      this.showError()
      return
    }
    const result = renderTemperatureChart(data, {
      orientation: this.orientation
    })
    const width =
      this.options.width ||
      (this.orientation === 'portrait' ? DEFAULT_PORTRAIT_WIDTH : DEFAULT_WIDTH)
    const height = Math.round((result.height / result.width) * width)
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
          value: result.dataURL,
          width,
          height,
          extension: { temperatureChartData: data }
        }
      })
      this.options.onInsert?.(data)
      this.destroy()
      return
    }
    const element: IElement = {
      // 生成 id 供二次编辑定位
      id: createUUID(),
      type: ElementType.IMAGE,
      value: result.dataURL,
      width,
      height,
      // 双击进入体温单编辑，禁用编辑器内置图片预览
      imgPreviewDisabled: true,
      extension: { temperatureChartData: data }
    }
    command.executeInsertElementList([element])
    this.options.onInsert?.(data)
    this.destroy()
  }

  private destroy() {
    if (this.renderTimer) {
      window.clearTimeout(this.renderTimer)
      this.renderTimer = null
    }
    this.mask?.remove()
    this.container?.remove()
    this.mask = null
    this.container = null
    this.editElementId = null
  }

  public execute(options?: ITemperatureChartOptions) {
    this.options = this.mergeOptions(options)
    this.lang = this.getLang(options)
    this.orientation = this.options.orientation || 'landscape'
    // 重复调用时先销毁已存在弹窗再重建
    this.destroy()
    this.currentData = deepClone(this.options.defaultData || DEFAULT_DATA)
    this.open()
  }
}

export default function temperatureChartPlugin(
  editor: Editor,
  defaultOptions?: ITemperatureChartOptions
) {
  const command = editor.command
  const temperatureChart = new TemperatureChart(editor, defaultOptions)

  command.executeTemperatureChart = (options?: ITemperatureChartOptions) => {
    temperatureChart.execute(options)
  }
}

export { renderTemperatureChart }
export type {
  ITemperatureChartData,
  ITemperatureChartOptions,
  ITemperatureChartLang,
  IVitalRecord,
  IVitalEvent,
  ITemperaturePatient,
  ITemperatureBottomData,
  ITemperatureSite
} from './interface'
