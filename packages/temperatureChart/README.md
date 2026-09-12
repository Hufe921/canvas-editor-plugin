# @hufe921/canvas-editor-plugin-temperature-chart

专业体温单（生命体征图表）插件，用于 [canvas-editor](https://github.com/Hufe921/canvas-editor)。

按国内护理通行规范（人卫《基础护理学》体温单绘制规范 + 电子病历通行样式）以 SVG 矢量绘制：

- 体温曲线：口温红`●` / 腋温红`×` / 肛温红`○`，红实线相连
- 脉搏蓝`×`蓝线相连，心率红`○`红线相连，脉搏短绌红色斜线阴影填充
- 物理降温：红`○` + 红虚线连降温前体温
- 体温不升（<35℃）向下红箭头、超量程（>42℃ / 脉搏>180）向上箭头
- 入院 / 手术 / 出院等事件红字竖排于 40~42℃ 标注带
- 呼吸数字行（上下错开）、疼痛评分区（红`▲`连线）与底部护理数据表格
- 眉栏：日期、住院日数、手术日数、时间（7 天 × 6 时间档）

模板模式表单（患者信息 / 按天录入 / 事件标注 / 护理数据）+ 高级模式 JSON 双模式编辑，实时预览，以图片插入文档，双击 / 右键已插入的体温单可二次编辑。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-temperature-chart
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import temperatureChartPlugin from '@hufe921/canvas-editor-plugin-temperature-chart'

const instance = new Editor()
instance.use(temperatureChartPlugin)

// 打开体温单编辑器
instance.command.executeTemperatureChart()

// 预填数据打开（直接进入高级模式）
instance.command.executeTemperatureChart({
  defaultData: {
    patient: {
      name: '张三',
      gender: '男',
      age: '45',
      department: '呼吸内科',
      bed: '12',
      admissionDate: '2026-09-08',
      hospitalNumber: '20260908123'
    },
    vitals: [
      { dayIndex: 0, slot: 0, temperature: 36.8, pulse: 82, respiration: 18 }
    ],
    bottom: {}
  },
  onInsert: data => {
    console.log('insert temperature chart:', data)
  }
})
```

## 参数

| 参数        | 类型                             | 说明                                                      |
| ----------- | -------------------------------- | --------------------------------------------------------- |
| width       | number                           | 可选，插入图片宽度，默认横向 760 / 竖向 620               |
| height      | number                           | 可选，插入图片高度，默认按体温单比例计算                  |
| orientation | 'landscape' \| 'portrait'        | 可选，插入方向：横向（原始）/ 竖向（旋转 90°），默认横向  |
| defaultData | ITemperatureChartData            | 可选，打开弹窗时预填的体温单数据（直接进入高级模式）      |
| locale      | string                           | 可选，弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang        | Partial\<ITemperatureChartLang\> | 可选，覆盖对应语言的弹窗文案                              |
| onInsert    | function                         | 可选，插入回调，参数为最终生效的体温单数据                |

完整数据结构与绘制规范见[文档](https://github.com/Hufe921/canvas-editor-plugin/blob/main/docs/plugins/temperature-chart.md)。

## License

MIT
