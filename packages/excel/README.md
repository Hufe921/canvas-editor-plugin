<h1 align="center">canvas-editor-plugin-excel</h1>

<p align="center">excel plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-excel --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import excelPlugin from '@hufe921/canvas-editor-plugin-excel'

const instance = new Editor()
instance.use(excelPlugin)

command.executeImportExcel({
  arrayBuffer: buffer
})
```
