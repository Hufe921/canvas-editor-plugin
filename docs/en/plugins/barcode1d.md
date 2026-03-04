# Barcode 1D

1D barcode generation plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-barcode1d
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode1DPlugin from '@hufe921/canvas-editor-plugin-barcode1d'

const instance = new Editor()
instance.use(barcode1DPlugin)

instance.executeInsertBarcode1D(
  content: string,
  width: number,
  height: number,
  options?: JsBarcode.Options
)
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| content | string | Barcode content |
| width | number | Barcode width |
| height | number | Barcode height |
| options | JsBarcode.Options | Optional, barcode configuration options |

## Example

```javascript
instance.executeInsertBarcode1D('123456789', 200, 100, {
  format: 'CODE128',
  lineColor: '#000000',
  background: '#ffffff'
})
```
