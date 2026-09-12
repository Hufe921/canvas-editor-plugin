// 体温测量部位：口温 / 腋温 / 肛温（对应符号红● / 红× / 红○）
export type ITemperatureSite = 'oral' | 'axilla' | 'rectum'

// 单个时间档的生命体征记录
export interface IVitalRecord {
  // 第几天（0-6，对应当前页 7 天）
  dayIndex: number
  // 时间档序号（0-5，对应 2/6/10/14/18/22 时）
  slot: number
  // 体温（℃），35-42 之间常规绘制，低于 35 视为体温不升
  temperature?: number
  // 体温测量部位，默认口温（红●）；腋温红×、肛温红○
  temperatureSite?: ITemperatureSite
  // 脉搏（次/分）
  pulse?: number
  // 心率（次/分），房颤/脉搏短绌时与脉搏同时记录
  heartRate?: number
  // 呼吸（次/分）
  respiration?: number
  // 疼痛评分（0-10 分），画于疼痛评分区红色▲
  pain?: number
  // 该时间点为物理降温后体温（红○ + 红虚线连降温前体温）
  physicalCooling?: boolean
}

// 40℃ 线上方红字竖排事件（入院/手术/出院/死亡/转入/分娩等）
export interface IVitalEvent {
  dayIndex: number
  slot: number
  // 事件名，如：入院、手术、出院、死亡、转入、分娩
  label: string
  // 事件时间，如：09:30 或 2026-09-10 09:30
  time?: string
}

// 底部护理数据表格（键为第几天 0-6，值为该天填写内容）
export interface ITemperatureBottomData {
  // 大便次数（次/日，灌肠后如 1/E）
  stool?: Record<number, string>
  // 尿量（ml）
  urine?: Record<number, string>
  // 出量（ml）
  output?: Record<number, string>
  // 入量（ml）
  intake?: Record<number, string>
  // 血压（mmHg）
  bloodPressure?: Record<number, string>
  // 体重（kg）
  weight?: Record<number, string>
  // 身高（cm）
  height?: Record<number, string>
  // 引流量（ml）
  drainage?: Record<number, string>
  // 过敏药物
  allergy?: Record<number, string>
}

export interface ITemperaturePatient {
  // 姓名
  name: string
  // 性别
  gender: string
  // 年龄
  age: string
  // 科别
  department: string
  // 床号
  bed: string
  // 入院日期（YYYY-MM-DD）
  admissionDate: string
  // 住院号
  hospitalNumber: string
}

// 体温单完整数据模型（同时用于二次编辑回填）
export interface ITemperatureChartData {
  patient: ITemperaturePatient
  // 手术/产后日期（YYYY-MM-DD），用于眉栏“手术日数”行，手术当日为 0
  surgeryDate?: string
  // 生命体征记录（仅记录已测量的时间档）
  vitals: IVitalRecord[]
  // 40℃ 线上方红字竖排事件
  events?: IVitalEvent[]
  // 底部护理数据表格
  bottom: ITemperatureBottomData
}

export interface ITemperatureChartLang {
  // 弹窗标题 / 页面标题
  title: string
  // 模式切换标签
  templateMode: string
  advancedMode: string
  // 患者信息区标题
  patientInfo: string
  // 患者信息字段
  name: string
  gender: string
  age: string
  department: string
  bed: string
  admissionDate: string
  hospitalNumber: string
  surgeryDate: string
  // 生命体征数据区标题
  vitalData: string
  // 数据表列头（时间档）
  slotLabels: string[]
  // 数据表行标签
  dayLabel: string
  // 生命体征表指标列头
  indicator: string
  temperature: string
  pulse: string
  heartRate: string
  respiration: string
  // 疼痛评分（0-10 分）
  pain: string
  // 添加 / 删除行
  addDay: string
  removeDay: string
  // 底部数据区标题
  bottomData: string
  // 事件标注区（40℃ 线上方红字竖排事件）
  eventData: string
  eventName: string
  eventTime: string
  addEvent: string
  stool: string
  urine: string
  output: string
  intake: string
  bloodPressure: string
  weight: string
  height: string
  drainage: string
  allergy: string
  // 高级模式
  optionPlaceholder: string
  invalidJson: string
  // 预览缩放：适应宽度
  fitPreview: string
  // 插入方向
  landscape: string
  portrait: string
  // 按钮
  cancel: string
  insert: string
  // 右键菜单
  editChart: string
}

// 插入方向：横向（原始方向）/ 竖向（旋转 90° 适配纵向页面）
export type ITemperatureChartOrientation = 'landscape' | 'portrait'

export interface ITemperatureChartOptions {
  // 插入图片宽度，默认横向 760 / 竖向 620
  width?: number
  // 插入图片高度，默认按体温单比例计算
  height?: number
  // 插入方向，默认横向
  orientation?: ITemperatureChartOrientation
  // 打开弹窗时预填的体温单数据
  defaultData?: ITemperatureChartData
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹窗文案
  lang?: Partial<ITemperatureChartLang>
  // 插入回调，参数为最终生效的体温单数据
  onInsert?: (data: ITemperatureChartData) => void
}
