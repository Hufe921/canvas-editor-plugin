import type { IChartLang } from '../interface'

export const PLUGIN_PREFIX = 'ce-chart'

export const DEFAULT_LOCALE = 'zhCN'

export const DEFAULT_WIDTH = 600

export const DEFAULT_HEIGHT = 400

export const RENDER_DEBOUNCE_TIME = 300

// 模板模式默认示例数值
export const DEFAULT_SERIES_DATA = '120,200,150,80,70'

export const PLUGIN_LANG_MAP: Record<string, IChartLang> = {
  zhCN: {
    templateMode: '模板',
    advancedMode: '高级',
    chartType: '图表类型',
    bar: '柱状图',
    line: '折线图',
    pie: '饼图',
    titleText: '标题',
    categories: '类目（逗号分隔）',
    seriesData: '数值（逗号分隔）',
    defaultCategories: '周一,周二,周三,周四,周五',
    optionPlaceholder: '请输入完整的 ECharts option JSON',
    invalidJson: 'JSON 格式错误',
    cancel: '取消',
    insert: '插入',
    editChart: '编辑图表'
  },
  en: {
    templateMode: 'Template',
    advancedMode: 'Advanced',
    chartType: 'Chart Type',
    bar: 'Bar',
    line: 'Line',
    pie: 'Pie',
    titleText: 'Title',
    categories: 'Categories (comma separated)',
    seriesData: 'Data (comma separated)',
    defaultCategories: 'Mon,Tue,Wed,Thu,Fri',
    optionPlaceholder: 'Enter the full ECharts option JSON',
    invalidJson: 'Invalid JSON',
    cancel: 'Cancel',
    insert: 'Insert',
    editChart: 'Edit Chart'
  }
}
