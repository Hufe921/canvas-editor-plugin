<h1 align="center">canvas-editor-plugin-barcode2d</h1>

<p align="center">barcode2d plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-barcode2d --save
```

```javascript
import Editor from "@hufe921/canvas-editor"
import barcode2DPlugin from "@hufe921/canvas-editor-plugin-barcode2d"

const instance = new Editor()
instance.use(barcode2DPlugin, options?: IBarcode2DOption)

instance.executeInsertBarcode2D(
  content: string,
  width: number,
  height: number,
  hints?: Map<EncodeHintType, any>
)
```
