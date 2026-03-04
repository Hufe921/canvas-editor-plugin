# 月经史

月经史记录表单插件，用于医疗记录场景。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-menstrual-history
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import menstrualHistoryPlugin from '@hufe921/canvas-editor-plugin-menstrual-history'

const instance = new Editor()
instance.use(menstrualHistoryPlugin)

command.executeLoadMenstrualHistory({
  data?: IMenstrualHistoryData,
  onConfirm?: (data: IMenstrualHistoryData & { svg: string; width: number; height: number }) => void,
  onCancel?: () => void
})
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| data | IMenstrualHistoryData | 可选，初始数据 |
| onConfirm | function | 可选，确认回调 |
| onCancel | function | 可选，取消回调 |

## 类型定义

```typescript
interface IMenstrualHistoryData {
  // 月经史数据字段
  age?: number
  cycle?: string
  duration?: string
  // ... 其他字段
}
```

## 示例

```javascript
command.executeLoadMenstrualHistory({
  data: {
    age: 14,
    cycle: '28-30',
    duration: '5-7'
  },
  onConfirm: (data) => {
    console.log('确认的月经史数据:', data)
    // data.svg 包含生成的 SVG 图像
    // data.width 和 data.height 是图像尺寸
  },
  onCancel: () => {
    console.log('用户取消了操作')
  }
})
```
