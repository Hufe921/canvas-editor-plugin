# 条形码 1D

一维条形码生成插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-barcode1d
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode1DPlugin from '@hufe921/canvas-editor-plugin-barcode1d'

const instance = new Editor()
instance.use(barcode1DPlugin)

instance.executeInsertBarcode1D(
  content: string,
  width: number,
  height: number,
  options?: JsBarcode.Options
)
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 条形码内容 |
| width | number | 条形码宽度 |
| height | number | 条形码高度 |
| options | JsBarcode.Options | 可选，条形码配置选项 |

## 示例

```javascript
instance.executeInsertBarcode1D('123456789', 200, 100, {
  format: 'CODE128',
  lineColor: '#000000',
  background: '#ffffff'
})
```
