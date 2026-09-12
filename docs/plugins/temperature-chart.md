# 体温单

专业体温单（生命体征图表）插件。按国内护理通行规范（人卫《基础护理学》体温单绘制规范 + 电子病历通行样式）以 SVG 矢量绘制体温单：体温 / 脉搏 / 心率曲线、物理降温、体温不升、事件红字、呼吸数字行与底部护理数据表格，实时预览并以 SVG 图片形式插入文档（矢量不失真），双击或右键已插入的体温单图片可二次编辑。

## 绘制规范

| 项目        | 规范                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面        | 7 天 / 页，每天 6 个时间档（2 / 6 / 10 / 14 / 18 / 22 时），每档 4 小格                                                                                                                     |
| 额头        | 标题居中，其下单行依次为姓名 / 性别 / 年龄 / 入院日期 / 病案号 / 科室 / 床号                                                                                                                |
| 体温刻度    | 35~42℃，每 1℃ 一大格、0.2℃ 一小格；刻度数字紧邻主图左缘                                                                                                                                     |
| 脉搏刻度    | 40~180 次 / 分（每小格 4 次），在体温刻度左列，两列间以竖线分隔                                                                                                                             |
| 刻度栏目    | 脉搏列竖排“脉搏次/分”（红色数字）、体温列竖排“体温(℃)”（黑色数字），两列以竖线分隔，兼作眉栏与底部表格的项目名列                                                                            |
| 体温符号    | 默认红`●`（口温样式，参考图统一画点）；指定腋温画红`×`、肛温画红`○`，相邻体温红实线相连                                                                                                     |
| 脉搏 / 心率 | 脉搏蓝`×`蓝线相连；心率红`○`红线相连；同一时间档两者红线相连（脉搏短绌）                                                                                                                    |
| 脉搏短绌    | 心率与脉搏曲线之间的区域以红色斜线阴影填充（经典三测单画法）                                                                                                                                |
| 经典配色    | 跨天竖线（贯穿眉栏至底部表格）、37℃ 参考线、时间行数字、脉搏刻度数字均为红色；体温刻度数字黑色                                                                                              |
| 物理降温    | 降温后体温画在降温前同一纵格内，红`○`并以红虚线连降温前体温；下次体温仍连降温前体温                                                                                                         |
| 体温不升    | 体温 < 35℃ 时在 35℃ 线画体温符号并向下红箭头（不超过 2 小格）                                                                                                                               |
| 超量程      | 脉搏 > 180 次 / 分在 180 线画蓝`×`并向上箭头（不超过 1 小格）；体温 > 42℃ 同理（红箭头）                                                                                                    |
| 事件        | 入院 / 手术 / 出院 / 死亡 / 转入 / 分娩等：在对应时间档竖排书写于 40~42℃ 标注带内（标签 + 中文时刻，如“入院日期 九时三十分”），该档左缘画红色竖虚线贯穿主图；相邻事件按文字宽度依次右移让位 |
| 重叠处理    | 脉搏点与体温符号重叠时，改为在体温符号外画红圈                                                                                                                                              |
| 呼吸        | 数字记录法：黑色数字记录于图表下方呼吸行，相邻数字上下错开                                                                                                                                  |
| 疼痛评分    | 呼吸行下方独立 0-10 分小网格，红色`▲`符号画点连线，分值刻度 10/8/6/4/2/0 标于体温刻度列                                                                                                     |
| 眉栏        | 日期、住院日数（入院日为第 1 天）、手术日数（手术当日为 0）、时间                                                                                                                           |
| 底部表格    | 大便、血压、身高、体重、总入量、总出量、尿量、引流量、过敏药物（按天填写，空白格划斜线注销）                                                                                                |

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
command.executeTemperatureChart()

// 也可以在注册插件时提供默认配置
instance.use(temperatureChartPlugin, {
  locale: 'en'
})
```

## 参数

| 参数        | 类型                             | 说明                                                                  |
| ----------- | -------------------------------- | --------------------------------------------------------------------- |
| width       | number                           | 可选，插入图片宽度，默认横向 760 / 竖向 620                           |
| height      | number                           | 可选，插入图片高度，默认按体温单比例计算                              |
| orientation | 'landscape' \| 'portrait'        | 可选，插入方向：横向（原始）/ 竖向（旋转 90° 适配纵向页面），默认横向 |
| defaultData | ITemperatureChartData            | 可选，打开弹窗时预填的体温单数据（直接进入高级模式）                  |
| locale      | string                           | 可选，弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置             |
| lang        | Partial\<ITemperatureChartLang\> | 可选，覆盖对应语言的弹窗文案                                          |
| onInsert    | function                         | 可选，插入回调，参数为最终生效的体温单数据                            |

> 体温单文书本身始终按中文医疗规范渲染（体温单 / 日期 / 住院日数等），`locale` 仅影响弹窗界面语言。

## 数据结构

```typescript
interface ITemperatureChartData {
  patient: {
    name: string // 姓名
    gender: string // 性别
    age: string // 年龄
    department: string // 科别
    bed: string // 床号
    admissionDate: string // 入院日期 YYYY-MM-DD
    hospitalNumber: string // 住院号
  }
  surgeryDate?: string // 手术/产后日期，用于眉栏“手术日数”行
  vitals: Array<{
    // 生命体征记录（仅记录已测量的时间档）
    dayIndex: number // 第几天（0-6）
    slot: number // 时间档（0-5 -> 2/6/10/14/18/22 时）
    temperature?: number // 体温 ℃
    temperatureSite?: 'oral' | 'axilla' | 'rectum' // 测量部位，默认口温（红●）
    pulse?: number // 脉搏 次/分
    heartRate?: number // 心率 次/分（房颤/脉搏短绌时记录）
    respiration?: number // 呼吸 次/分
    pain?: number // 疼痛评分 0-10 分（画于疼痛评分区）
    physicalCooling?: boolean // 该时间点为物理降温后体温
  }>
  events?: Array<{
    // 40-42℃ 红字竖排事件
    dayIndex: number
    slot: number
    label: string // 入院/手术/出院/死亡/转入/分娩
    time?: string // 如 09:30
  }>
  bottom: {
    // 底部护理数据（键为第几天 0-6）
    stool?: Record<number, string> // 大便次数（灌肠后如 1/E）
    urine?: Record<number, string> // 尿量 ml
    output?: Record<number, string> // 出量 ml
    intake?: Record<number, string> // 入量 ml
    bloodPressure?: Record<number, string> // 血压 mmHg
    weight?: Record<number, string> // 体重 kg
    height?: Record<number, string> // 身高 cm
    drainage?: Record<number, string> // 引流量 ml
    allergy?: Record<number, string> // 过敏药物
  }
}
```

## 示例

```javascript
command.executeTemperatureChart({
  width: 760,
  onInsert: data => {
    console.log('insert temperature chart:', data)
  }
})
```

## 交互说明

- **模板模式**：患者信息表单 + 按天录入（天切换标签快速切天，编辑当日 2/6/10/14/18/22 时的体温、脉搏、呼吸与当日护理数据，支持添加 / 删除天，有数据的天带圆点标记）+ 事件标注（入院 / 手术 / 出院等，按天与时间档填写事件名和时间）
- **高级模式**：完整 JSON 编辑，支持模板模式未覆盖的规范能力（测量部位、心率 / 短绌、物理降温等），两种模式可互转回填
- **预览**：随输入实时刷新，支持 100% 原始大小 / 适应宽度 / 缩放
- **插入方向**：弹窗底部可切换横向插入（原始方向）或竖向插入（整体旋转 90°，适配纵向页面打印）
- **二次编辑**：双击或右键已插入的体温单图片，用原始数据重新打开编辑器，确认后原位更新
