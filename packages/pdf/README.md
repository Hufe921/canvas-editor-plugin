<h1 align="center">canvas-editor-plugin-pdf</h1>

<p align="center">pdf plugin for canvas-editor</p>

## 出处

本项目基于 [canvas-editor-pdf](https://github.com/douglasmatheus/canvas-editor-pdf.git) 进行修改和优化。

## usage

```bash
npm i @hufe921/canvas-editor-plugin-pdf --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import pdfPlugin from '@hufe921/canvas-editor-plugin-pdf'

const instance = new Editor()
instance.use(pdfPlugin)

command.executeExportPdf({
  fileName: 'document.pdf',
  pdfOptions: {
    loadDefaultFonts: true
  }
})
```
