<h1 align="center">canvas-editor-plugin-chart</h1>

<p align="center">chart plugin for canvas-editor</p>

## 简介

基于 ECharts 的 canvas-editor 数据图表插件。支持柱状图、折线图、饼图的模板化配置，以及高级模式下直接编辑完整的 ECharts option JSON。图表实时预览，并以图片形式插入文档，双击或右键已插入的图表图片可二次编辑。

## 安装

```bash
npm i @hufe921/canvas-editor-plugin-chart echarts --save
```

> 注意：echarts 为 peerDependencies，需自行安装。

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import chartPlugin from '@hufe921/canvas-editor-plugin-chart'

const instance = new Editor()
instance.use(chartPlugin)

// 打开图表弹窗
instance.command.executeChart()

// 使用自定义配置
instance.command.executeChart({
  width: 600,
  height: 400,
  // 打开弹窗时预填的 ECharts option（直接进入高级模式）
  defaultOption: {
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [120, 200, 150] }]
  },
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale: 'en',
  // 覆盖对应语言的弹窗文案
  lang: {
    insert: 'Insert Chart'
  },
  onInsert: option => {
    console.log('insert chart:', option)
  }
})

// 也可以在注册插件时提供默认配置
instance.use(chartPlugin, {
  locale: 'en'
})
```

## 配置项

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| width | 插入图片宽度 | `number` | 600 |
| height | 插入图片高度 | `number` | 400 |
| defaultOption | 打开弹窗时预填的 ECharts option（直接进入高级模式） | `object` | - |
| locale | 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置 | `string` | - |
| lang | 覆盖对应语言的弹窗文案 | `Partial<IChartLang>` | - |
| onInsert | 插入图表回调，参数为最终生效的 ECharts option | `(option: object) => void` | - |
