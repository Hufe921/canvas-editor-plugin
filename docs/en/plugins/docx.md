# DOCX Import/Export

DOCX file import and export plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-docx
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'

const instance = new Editor()
instance.use(docxPlugin)
```

## Import DOCX

```javascript
command.executeImportDocx({
  arrayBuffer: buffer
})
```

## Export DOCX

```javascript
instance.executeExportDocx({
  fileName: string
})
```

## Parameters

### Import Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| arrayBuffer | ArrayBuffer | ArrayBuffer of DOCX file |

### Export Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| fileName | string | Exported file name |
