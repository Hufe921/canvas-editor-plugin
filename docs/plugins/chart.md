# 图表

基于 ECharts 的数据图表插件。支持柱状图、折线图、饼图的模板化配置，以及高级模式下直接编辑完整的 ECharts option JSON。图表实时预览，并以图片形式插入文档，双击或右键已插入的图表图片可二次编辑。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-chart echarts
```

> 注意：echarts 为 peerDependencies，需自行安装。

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import chartPlugin from '@hufe921/canvas-editor-plugin-chart'

const instance = new Editor()
instance.use(chartPlugin)

// 打开图表弹窗
command.executeChart()

// 也可以在注册插件时提供默认配置
instance.use(chartPlugin, {
  locale: 'en'
})
```

## 参数

| 参数          | 类型                   | 说明                                                      |
| ------------- | ---------------------- | --------------------------------------------------------- |
| width         | number                 | 可选，插入图片宽度，默认 600                              |
| height        | number                 | 可选，插入图片高度，默认 400                              |
| defaultOption | object                 | 可选，打开弹窗时预填的 ECharts option（直接进入高级模式） |
| locale        | string                 | 可选，弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang          | Partial\<IChartLang\>  | 可选，覆盖对应语言的弹窗文案                              |
| onInsert      | function               | 可选，插入图表回调，参数为最终生效的 ECharts option       |

## 示例

```javascript
command.executeChart({
  width: 600,
  height: 400,
  // 打开弹窗时预填的 ECharts option（直接进入高级模式）
  defaultOption: {
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [120, 200, 150] }]
  },
  onInsert: option => {
    console.log('insert chart:', option)
  }
})
```
