import type {
  ITemperatureBottomData,
  ITemperatureChartData,
  ITemperatureChartLang,
  IVitalRecord
} from '../interface'

export const PLUGIN_PREFIX = 'ce-temperature-chart'

export const DEFAULT_LOCALE = 'zhCN'

// 插入文档的默认显示宽度（高度按渲染比例计算）
export const DEFAULT_WIDTH = 760

// 竖向插入（旋转 90°）时的默认显示宽度
export const DEFAULT_PORTRAIT_WIDTH = 620

export const RENDER_DEBOUNCE_TIME = 300

// 每页天数与每日时间档
export const DAY_COUNT = 7
export const TIME_SLOTS = [2, 6, 10, 14, 18, 22]

// 体温刻度：35-42℃，每大格 1℃，每小格 0.2℃
export const TEMP_MIN = 35
export const TEMP_MAX = 42
export const TEMP_MINOR_PER_MAJOR = 5

// 脉搏刻度：40-180 次/分（与体温网格共用 35 个小格）
export const PULSE_MIN = 40
export const PULSE_MAX = 180

// 主图网格：每个时间档 1 列，列内再分 4 小格（用于时间精确定位）
export const SLOT_MINOR_COUNT = 4

// ---------------- 渲染布局尺寸（逻辑像素） ----------------
export const LAYOUT = {
  // 页面外边距
  padding: 16,
  // 左侧脉搏刻度列宽：竖排“脉搏次/分”标签 + 红色刻度数字（180~40）
  axisPulseWidth: 40,
  // 左侧体温刻度列宽：竖排“体温(℃)”标签 + 黑色刻度数字（42~35）；
  // 兼作眉栏/呼吸行/底部表格项目名列，需容纳“过敏药物(ml)”并留出右缘空隙
  axisTempWidth: 38,
  // 每个小格的宽度（一个时间档 = SLOT_MINOR_COUNT 个小格）；
  // 标准三测单每列很窄，整幅偏竖长，过宽会显得横向铺开
  minorCellWidth: 4.8,
  // 每个小格的高度（0.2℃ 或 4 次/分）：标准三测单为瘦高格，纵高约为横宽的 2.7 倍
  minorCellHeight: 19,
  // 眉栏每行高度
  headerRowHeight: 20,
  // 底部表格每行高度
  bottomRowHeight: 22,
  // 疼痛评分区高度（0-10 分，每分一格）
  painRowHeight: 110,
  // 患者信息栏高度（单行）
  patientInfoHeight: 34,
  // 标题高度
  titleHeight: 36,
  // 各区块间距
  sectionGap: 8
} as const

// 主图宽度 = 42 档 × 4 小格 × 小格宽
export const GRID_WIDTH =
  DAY_COUNT * TIME_SLOTS.length * SLOT_MINOR_COUNT * LAYOUT.minorCellWidth

// 主图高度 = (42-35)℃ × 5 小格 × 小格高
export const GRID_HEIGHT =
  (TEMP_MAX - TEMP_MIN) *
  TEMP_MINOR_PER_MAJOR *
  LAYOUT.minorCellHeight

export const COLORS = {
  // 网格线：小格（0.2℃）/ 时间档与整度刻度 / 天边界与外框
  // 标准三测单以整度横线与时间档竖线为骨架，0.2℃ 小格线需足够淡才不糊成一片
  gridMinor: '#e2e6ec',
  gridMajor: '#a8b0bb',
  gridBoundary: '#3d434d',
  // 空白格注销斜线（比网格线深，确保可见）
  slash: '#6f7680',
  // 夜间时段（18:00-06:00）背景
  night: '#f3f5f9',
  // 体温/心率/事件用红笔，脉搏用蓝笔
  blue: '#1d4ed8',
  red: '#dc2626',
  // 正文文字
  text: '#1f2328',
  // 背景
  background: '#ffffff'
} as const

export const FONT_FAMILY =
  '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'

export const PLUGIN_LANG_MAP: Record<string, ITemperatureChartLang> = {
  zhCN: {
    title: '体温单',
    templateMode: '模板',
    advancedMode: '高级',
    patientInfo: '患者信息',
    name: '姓名',
    gender: '性别',
    age: '年龄',
    department: '科别',
    bed: '床号',
    admissionDate: '入院日期',
    hospitalNumber: '住院号',
    surgeryDate: '手术日期',
    vitalData: '生命体征',
    slotLabels: ['2时', '6时', '10时', '14时', '18时', '22时'],
    dayLabel: '第{n}天',
    indicator: '指标',
    temperature: '体温(℃)',
    pulse: '脉搏(次/分)',
    heartRate: '心率(次/分)',
    respiration: '呼吸(次/分)',
    pain: '疼痛(分)',
    addDay: '添加一天',
    removeDay: '删除',
    bottomData: '护理数据',
    eventData: '事件标注',
    eventName: '事件（如：入院日期）',
    eventTime: '时间（如：09:30）',
    addEvent: '添加事件',
    stool: '大便(次)',
    urine: '尿量(ml)',
    output: '出量(ml)',
    intake: '入量(ml)',
    bloodPressure: '血压(mmHg)',
    weight: '体重(kg)',
    height: '身高(cm)',
    drainage: '引流量(ml)',
    allergy: '过敏药物',
    optionPlaceholder: '请输入完整的体温单数据 JSON',
    invalidJson: 'JSON 格式错误',
    fitPreview: '适应宽度',
    landscape: '横向插入',
    portrait: '竖向插入',
    cancel: '取消',
    insert: '插入',
    editChart: '编辑体温单'
  },
  en: {
    title: 'Temperature Chart',
    templateMode: 'Template',
    advancedMode: 'Advanced',
    patientInfo: 'Patient Information',
    name: 'Name',
    gender: 'Gender',
    age: 'Age',
    department: 'Department',
    bed: 'Bed No.',
    admissionDate: 'Admission Date',
    hospitalNumber: 'Hospital No.',
    surgeryDate: 'Surgery Date',
    vitalData: 'Vital Signs',
    slotLabels: ['2', '6', '10', '14', '18', '22'],
    dayLabel: 'Day {n}',
    indicator: 'Indicator',
    temperature: 'Temp (℃)',
    pulse: 'Pulse (bpm)',
    heartRate: 'Heart Rate (bpm)',
    respiration: 'Resp (brpm)',
    pain: 'Pain',
    addDay: 'Add Day',
    removeDay: 'Remove',
    bottomData: 'Nursing Data',
    eventData: 'Events',
    eventName: 'Event (e.g. Admission)',
    eventTime: 'Time (e.g. 09:30)',
    addEvent: 'Add Event',
    stool: 'Stool',
    urine: 'Urine (ml)',
    output: 'Output (ml)',
    intake: 'Intake (ml)',
    bloodPressure: 'BP (mmHg)',
    weight: 'Weight (kg)',
    height: 'Height (cm)',
    drainage: 'Drainage (ml)',
    allergy: 'Drug Allergy',
    optionPlaceholder: 'Enter the full temperature chart data JSON',
    invalidJson: 'Invalid JSON',
    fitPreview: 'Fit',
    landscape: 'Landscape',
    portrait: 'Portrait',
    cancel: 'Cancel',
    insert: 'Insert',
    editChart: 'Edit Temperature Chart'
  }
}

// 体温单右上角固定的日期/时间等眉栏行标签（渲染用，随 locale 走 zhCN）
export const SHEET_LABELS = {
  date: '日期',
  hospitalDays: '住院日数',
  surgeryDays: '手术日数',
  time: '时间'
} as const

// 底部表格行定义：字段键 + 标签（顺序与命名对齐经典三测单）
export const BOTTOM_ROWS: {
  key: keyof ITemperatureBottomData
  label: string
}[] = [
  { key: 'stool', label: '大便(次/日)' },
  { key: 'bloodPressure', label: '血压(mmHg)' },
  { key: 'height', label: '身高(cm)' },
  { key: 'weight', label: '体重(kg)' },
  { key: 'intake', label: '总入量(ml)' },
  { key: 'output', label: '总出量(ml)' },
  { key: 'urine', label: '尿量(ml)' },
  { key: 'drainage', label: '引流量(ml)' },
  { key: 'allergy', label: '过敏药物(ml)' }
]

// 模板模式预填示例数据：按临床规范编制——
// 1. 体温/脉搏/呼吸绑定测量（每条记录三项齐全）
// 2. 入院当日 09:30 入院，10:00 档起测；发热期 q4h，稳定期 q8h
// 3. 脉搏随体温同步变化（约 +12 次/分/℃），物理降温演示红圈红虚线
// 4. 出入量成对记录，可核算液体平衡；大便入院日以“/”表示未评估
function sampleVitals(): IVitalRecord[] {
  const vitals: IVitalRecord[] = []
  const push = (
    dayIndex: number,
    slot: number,
    temperature: number,
    pulse: number,
    respiration: number,
    pain?: number
  ) => {
    vitals.push({ dayIndex, slot, temperature, pulse, respiration, pain })
  }
  // 第 1 天（09-08）：09:30 入院，10:00 档起测，低热伴轻度疼痛
  push(0, 2, 37.8, 92, 20, 3)
  push(0, 3, 38.0, 96, 21, 3)
  push(0, 4, 38.2, 100, 22, 4)
  push(0, 5, 37.9, 94, 20, 2)
  // 第 2 天（09-09）：发热高峰 q4h，10:00 39.2℃ 后物理降温（红圈红虚线）
  // 脉搏随体温约 +12~14 次/分/℃，符合生理反应
  push(1, 0, 38.5, 104, 24, 4)
  push(1, 1, 39.0, 110, 26, 5)
  push(1, 2, 39.2, 114, 27, 5)
  vitals.push({
    dayIndex: 1,
    slot: 2,
    temperature: 38.4,
    physicalCooling: true
  })
  push(1, 3, 38.1, 100, 23, 3)
  push(1, 4, 37.8, 96, 22, 2)
  push(1, 5, 37.6, 92, 21, 1)
  // 第 3 天（09-10）：好转，q4h
  push(2, 0, 37.5, 90, 20, 2)
  push(2, 1, 37.3, 88, 19, 1)
  push(2, 2, 37.1, 86, 19, 0)
  push(2, 3, 36.9, 84, 18, 0)
  push(2, 4, 36.8, 82, 18, 0)
  push(2, 5, 36.7, 80, 17, 0)
  // 第 4 天（09-11）：稳定，q4h 续
  push(3, 0, 36.8, 80, 17)
  push(3, 1, 36.6, 78, 17)
  push(3, 2, 36.7, 80, 16)
  push(3, 3, 36.6, 78, 16)
  push(3, 4, 36.7, 78, 17)
  push(3, 5, 36.6, 78, 16)
  // 第 5-7 天（09-12 ~ 09-14）：医嘱改 q8h（6/14/22 时），减频非漏测
  push(4, 1, 36.5, 76, 16)
  push(4, 3, 36.6, 78, 16)
  push(4, 5, 36.6, 76, 16)
  push(5, 1, 36.5, 76, 16)
  push(5, 3, 36.6, 76, 15)
  push(5, 5, 36.5, 76, 16)
  push(6, 1, 36.4, 74, 15)
  push(6, 3, 36.5, 76, 15)
  push(6, 5, 36.4, 74, 15)
  return vitals
}

export const DEFAULT_DATA: ITemperatureChartData = {
  patient: {
    name: '张三',
    gender: '男',
    age: '45',
    department: '呼吸内科',
    bed: '12',
    admissionDate: '2026-09-08',
    hospitalNumber: '20260908123'
  },
  surgeryDate: '',
  vitals: sampleVitals(),
  events: [
    { dayIndex: 0, slot: 2, label: '入院日期', time: '09:30' }
  ],
  bottom: {
    // 大便：入院日“/”表示未评估；1/E 为灌肠后排便
    stool: { 0: '/', 1: '1', 2: '0', 3: '1/E', 4: '1', 5: '0', 6: '1' },
    // 出入量成对记录（含饮食与输液），可核算液体平衡
    urine: { 0: '1700', 1: '2050', 2: '1850', 3: '1800', 4: '1750', 5: '1700', 6: '1700' },
    output: { 0: '1750', 1: '2100', 2: '1900', 3: '1850', 4: '1800', 5: '1750', 6: '1750' },
    intake: { 0: '2050', 1: '2300', 2: '2150', 3: '2100', 4: '2050', 5: '2050', 6: '2050' },
    bloodPressure: { 0: '122/78', 1: '118/74', 2: '120/76', 3: '118/76', 4: '118/74', 5: '116/74', 6: '118/76' },
    weight: { 0: '65' },
    height: { 0: '172' },
    // 术后引流：第 2 天拔管后不再记录
    drainage: { 0: '120', 1: '95' },
    // 过敏史：入院日评估一次，无过敏以“/”注销
    allergy: { 0: '/' }
  }
}
