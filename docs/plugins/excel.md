# Excel 导入

Excel 文件导入插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-excel
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import excelPlugin from '@hufe921/canvas-editor-plugin-excel'

const instance = new Editor()
instance.use(excelPlugin)

command.executeImportExcel({
  arrayBuffer: buffer
})
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| arrayBuffer | ArrayBuffer | Excel 文件的 ArrayBuffer |

## 示例

```javascript
// 读取文件后导入
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
