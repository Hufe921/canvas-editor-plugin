<h1 align="center">canvas-editor-plugin-barcode1d</h1>

<p align="center">barcode1d plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-barcode1d --save
```

```javascript
import Editor from "@hufe921/canvas-editor"
import barcode1DPlugin from "@hufe921/canvas-editor-plugin-barcode1d"

const instance = new Editor()
instance.use(barcode1DPlugin)

instance.executeInsertBarcode1D(
  content: string,
  width: number,
  height: number,
  options?: JsBarcode.Options
)
```
