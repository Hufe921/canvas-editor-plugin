# Menstrual History

Menstrual history record form plugin for medical record scenarios.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-menstrual-history
```

## Usage

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

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| data | IMenstrualHistoryData | Optional, initial data |
| onConfirm | function | Optional, confirm callback |
| onCancel | function | Optional, cancel callback |

## Type Definition

```typescript
interface IMenstrualHistoryData {
  // Menstrual history data fields
  age?: number
  cycle?: string
  duration?: string
  // ... other fields
}
```

## Example

```javascript
command.executeLoadMenstrualHistory({
  data: {
    age: 14,
    cycle: '28-30',
    duration: '5-7'
  },
  onConfirm: (data) => {
    console.log('Confirmed menstrual history data:', data)
    // data.svg contains the generated SVG image
    // data.width and data.height are the image dimensions
  },
  onCancel: () => {
    console.log('User cancelled the operation')
  }
})
```
