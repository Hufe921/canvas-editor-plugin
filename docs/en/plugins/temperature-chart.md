# Temperature Chart

Professional vital signs sheet (temperature chart) plugin. Renders the chart as crisp SVG following the common Chinese nursing standards (People's Medical Publishing House "Basic Nursing" plotting rules + common EHR styles): temperature / pulse / heart-rate curves, physical cooling, subnormal temperature, red vertical event notes, the respiration number row and the bottom nursing data table. It is previewed in real time and inserted into the document as a vector SVG image; double-clicking or right-clicking an inserted sheet image reopens it for editing.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-temperature-chart
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import temperatureChartPlugin from '@hufe921/canvas-editor-plugin-temperature-chart'

const instance = new Editor()
instance.use(temperatureChartPlugin)

// Open the temperature chart editor
command.executeTemperatureChart()

// Default options can also be provided when registering the plugin
instance.use(temperatureChartPlugin, {
  locale: 'en'
})
```

## Options

| Option      | Type                             | Description                                                                                      |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| width       | number                           | Optional, inserted image width, default 760 (landscape) / 620 (portrait)                         |
| height      | number                           | Optional, inserted image height, default keeps the sheet aspect ratio                            |
| orientation | 'landscape' \| 'portrait'        | Optional, insert orientation: as-is, or rotated 90° to fit portrait pages; defaults to landscape |
| defaultData | ITemperatureChartData            | Optional, sheet data prefilled when the dialog opens (enters advanced mode)                      |
| locale      | string                           | Optional, dialog language (built-in zhCN, en), defaults to editor locale                         |
| lang        | Partial\<ITemperatureChartLang\> | Optional, override dialog texts of the corresponding language                                    |
| onInsert    | function                         | Optional, insert callback with the final sheet data                                              |

> The sheet itself is always rendered in Chinese medical form (体温单 / 日期 / 住院日数, etc.); `locale` only affects the dialog UI language.

## Plotting conventions

- Page: 7 days per sheet, 6 time slots per day (2 / 6 / 10 / 14 / 18 / 22h), each slot split into 4 minor cells
- Heading: centered title, with a single line below it: name / gender / age / admission date / medical record no. / department / bed no.
- Left-side dual scale: temperature 35~42℃ (1℃ per major cell, 0.2℃ per minor cell) with digits flush against the chart, and pulse 40~180 bpm (4 bpm per minor cell) in the column to its left, separated by a vertical rule
- Column captions: a row under the time row labels "脉搏(次/分)" and "体温(℃)", each centered over its own scale column
- Temperature symbols: red `●` by default (reference style); axillary red `×` and rectal red `○` when specified, connected by solid red lines
- Pulse blue `×` connected by blue lines; heart rate red `○` connected by red lines; pulse and heart rate at the same slot are joined in red (pulse deficit)
- Pulse deficit: the region between the pulse and heart-rate curves is filled with red diagonal hatching (classic sheet style)
- Classic coloring: day-boundary verticals (running through the header rows to the bottom table), the 37℃ reference line, time-row digits and pulse scale digits are red; temperature scale digits are black
- Physical cooling: post-cooling temperature drawn in the same column as pre-cooling one, as a red `○` connected by a red dashed line; the next temperature still connects to the pre-cooling point
- Subnormal temperature (< 35℃): blue dot on the 35℃ line with a downward arrow (≤ 2 minor cells)
- Out of range: pulse > 180 bpm drawn on the 180 line with an upward red arrow (≤ 1 minor cell); temperature > 42℃ likewise
- Events (admission / surgery / discharge / death / transfer / delivery): written vertically inside the 40~42℃ band at the matching slot (label plus the time, e.g. "入院日期 九时三十分"), with a red vertical dashed line at that slot's left edge running through the chart; adjacent events shift right by text width to avoid overlap
- Overlap: when a pulse point coincides with a temperature symbol, a red circle is drawn around the temperature symbol instead
- Respiration: numeric recording — black numbers in the row below the chart, staggered up and down
- Pain score: a dedicated 0-10 mini grid below the respiration row, red `▲` markers connected by red lines, scale 10/8/6/4/2/0 labeled to the left of the row name
- Header rows: date, hospital days (admission day = 1), surgery days (surgery day = 0), time slots
- Bottom table: stool, blood pressure, height, weight, total intake, total output, urine, drainage, drug allergy (per day; empty cells are slashed out)

## Data structure

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
  surgeryDate?: string // surgery/delivery date for the surgery-days header row
  vitals: Array<{
    dayIndex: number // day 0-6
    slot: number // 0-5 -> 2/6/10/14/18/22h
    temperature?: number // ℃
    temperatureSite?: 'oral' | 'axilla' | 'rectum' // defaults to axilla
    pulse?: number // bpm
    heartRate?: number // bpm (recorded for pulse deficit)
    respiration?: number // brpm
    physicalCooling?: boolean // this point is a post-cooling temperature
  }>
  events?: Array<{
    dayIndex: number
    slot: number
    label: string // e.g. 入院 / 手术 / 出院
    time?: string // e.g. 09:30
  }>
  bottom: {
    // nursing data keyed by day 0-6
    stool?: Record<number, string>
    urine?: Record<number, string>
    output?: Record<number, string>
    intake?: Record<number, string>
    bloodPressure?: Record<number, string>
    weight?: Record<number, string>
    height?: Record<number, string>
    drainage?: Record<number, string>
    allergy?: Record<number, string>
  }
}
```

## Interaction

- **Template mode**: patient info form + day-based entry (day tabs to switch days quickly; edit temperature / pulse / respiration of the six time slots and the nursing data of the selected day; days can be added / removed, days with data are dot-marked)
- **Advanced mode**: full JSON editing, covering spec features not exposed in the template (site, heart rate / pulse deficit, physical cooling, event notes); the two modes convert into each other
- **Preview**: refreshes live; supports 100% actual size / fit width / zoom in and out
- **Insert orientation**: toggle landscape (as-is) or portrait (rotated 90° to fit portrait pages) in the dialog footer
- **Re-edit**: double-click or right-click an inserted sheet image to reopen the editor with the original data; confirming updates it in place
