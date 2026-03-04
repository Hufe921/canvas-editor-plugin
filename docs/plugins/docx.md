# DOCX 导入导出

DOCX 文件的导入和导出插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-docx
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'

const instance = new Editor()
instance.use(docxPlugin)
```

## 导入 DOCX

```javascript
command.executeImportDocx({
  arrayBuffer: buffer
})
```

## 导出 DOCX

```javascript
instance.executeExportDocx({
  fileName: string
})
```

## 参数

### 导入参数

| 参数 | 类型 | 说明 |
|------|------|------|
| arrayBuffer | ArrayBuffer | DOCX 文件的 ArrayBuffer |

### 导出参数

| 参数 | 类型 | 说明 |
|------|------|------|
| fileName | string | 导出的文件名 |
