# PDF 导出

PDF 文件导出插件。

## 出处

本项目基于 [canvas-editor-pdf](https://github.com/douglasmatheus/canvas-editor-pdf.git) 进行修改和优化。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-pdf
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import pdfPlugin from '@hufe921/canvas-editor-plugin-pdf'

const instance = new Editor()
instance.use(pdfPlugin)
```

## 导出 PDF

```javascript
command.executeExportPdf({
  fileName: 'document.pdf',
  pdfOptions: {
    loadDefaultFonts: true
  }
})
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| fileName | string | 导出的文件名，默认 `export.pdf` |
| pdfOptions | PdfOptions | PDF 生成选项 |

### PdfOptions

| 参数 | 类型 | 说明 |
|------|------|------|
| loadDefaultFonts | boolean | 是否加载默认字体（微软雅黑、Arial），默认 `false` |
| fontSource | 'cdn' \| 'bundled' \| { dir: string } | 字体来源，默认 `cdn` |