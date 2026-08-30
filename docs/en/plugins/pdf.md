# PDF Export

PDF file export plugin.

## Source

This project is based on [canvas-editor-pdf](https://github.com/douglasmatheus/canvas-editor-pdf.git) with modifications and optimizations.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-pdf
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import pdfPlugin from '@hufe921/canvas-editor-plugin-pdf'

const instance = new Editor()
instance.use(pdfPlugin)
```

## Export PDF

```javascript
command.executeExportPdf({
  fileName: 'document.pdf',
  pdfOptions: {
    loadDefaultFonts: true
  }
})
```

## Options

| Option | Type | Description |
|--------|------|-------------|
| fileName | string | Export file name, default `export.pdf` |
| pdfOptions | PdfOptions | PDF generation options |

### PdfOptions

| Option | Type | Description |
|--------|------|-------------|
| loadDefaultFonts | boolean | Whether to load default fonts (Microsoft YaHei, Arial), default `false` |
| fontSource | 'cdn' \| 'bundled' \| { dir: string } | Font source, default `cdn` |