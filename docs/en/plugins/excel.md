# Excel Import

Excel file import plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-excel
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import excelPlugin from '@hufe921/canvas-editor-plugin-excel'

const instance = new Editor()
instance.use(excelPlugin)

command.executeImportExcel({
  arrayBuffer: buffer
})
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| arrayBuffer | ArrayBuffer | ArrayBuffer of Excel file |

## Example

```javascript
// Import after reading file
const fileInput = document.getElementById('file')
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    command.executeImportExcel({
      arrayBuffer: e.target.result
    })
  }
  reader.readAsArrayBuffer(file)
})
```
