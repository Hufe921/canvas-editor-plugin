<h1 align="center">canvas-editor-plugin-docx</h1>

<p align="center">docx plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-docx --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'

const instance = new Editor()
instance.use(docxPlugin)

command.executeImportDocx({
  arrayBuffer: buffer
})

instance.executeExportDocx({
  fileName: string
})
```
