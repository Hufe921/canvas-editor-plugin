# Chart

ECharts-based data chart plugin. Supports templated configuration of bar, line and pie charts, and an advanced mode for editing the full ECharts option JSON directly. Charts are previewed in real time and inserted into the document as images; double-clicking or right-clicking an inserted chart image reopens it for editing.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-chart echarts
```

> Note: echarts is a peerDependency and must be installed by yourself.

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import chartPlugin from '@hufe921/canvas-editor-plugin-chart'

const instance = new Editor()
instance.use(chartPlugin)

// Open the chart dialog
command.executeChart()

// Default options can also be provided when registering the plugin
instance.use(chartPlugin, {
  locale: 'en'
})
```

## Options

| Option        | Type                  | Description                                                                  |
| ------------- | --------------------- | ---------------------------------------------------------------------------- |
| width         | number                | Optional, inserted image width, default 600                                  |
| height        | number                | Optional, inserted image height, default 400                                 |
| defaultOption | object                | Optional, ECharts option prefilled when the dialog opens (enters advanced mode directly) |
| locale        | string                | Optional, dialog language (built-in zhCN, en), defaults to editor locale     |
| lang          | Partial\<IChartLang\> | Optional, override dialog texts of the corresponding language                |
| onInsert      | function              | Optional, insert callback with the final ECharts option                      |

## Example

```javascript
command.executeChart({
  width: 600,
  height: 400,
  // ECharts option prefilled when the dialog opens (enters advanced mode directly)
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
