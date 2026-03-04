# Barcode 2D

2D barcode (QR code) generation plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-barcode2d
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode2DPlugin from '@hufe921/canvas-editor-plugin-barcode2d'

const instance = new Editor()
instance.use(barcode2DPlugin, options?: IBarcode2DOption)

instance.executeInsertBarcode2D(
  content: string,
  width: number,
  height: number,
  hints?: Map<EncodeHintType, any>
)
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| content | string | QR code content |
| width | number | QR code width |
| height | number | QR code height |
| hints | Map | Optional, encoding hints |

## Plugin Options

```typescript
interface IBarcode2DOption {
  // Plugin configuration options
}
```
