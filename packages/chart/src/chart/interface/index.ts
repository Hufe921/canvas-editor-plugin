// 图表类型
export type IChartType = 'bar' | 'line' | 'pie'

// 弹窗模式：模板 / 高级
export type IChartMode = 'template' | 'advanced'

export interface IChartLang {
  // 模板模式标签
  templateMode: string
  // 高级模式标签
  advancedMode: string
  // 图表类型标签
  chartType: string
  // 柱状图
  bar: string
  // 折线图
  line: string
  // 饼图
  pie: string
  // 标题输入框标签
  titleText: string
  // 类目输入框标签（逗号分隔）
  categories: string
  // 系列数值输入框标签（逗号分隔）
  seriesData: string
  // 模板模式默认类目示例数据
  defaultCategories: string
  // 高级模式 option 输入框占位文案
  optionPlaceholder: string
  // JSON 格式错误提示
  invalidJson: string
  // 取消按钮
  cancel: string
  // 插入按钮
  insert: string
  // 右键菜单：编辑图表
  editChart: string
}

export interface IChartOptions {
  // 插入图片宽度，默认 600
  width?: number
  // 插入图片高度，默认 400
  height?: number
  // 打开弹窗时预填的 ECharts option（直接进入高级模式）
  defaultOption?: object
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹窗文案
  lang?: Partial<IChartLang>
  // 插入图表回调，参数为最终生效的 ECharts option
  onInsert?: (option: object) => void
}
