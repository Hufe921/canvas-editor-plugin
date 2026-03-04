# 条形码 2D

二维条形码（二维码）生成插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-barcode2d
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode2DPlugin from '@hufe921/canvas-editor-plugin-barcode2d'

const instance = new Editor()
instance.use(barcode2DPlugin, options?: IBarcode2DOption)

instance.executeInsertBarcode2D(
  content: string,
  width: number,
  height: number,
  hints?: Map<EncodeHintType, any>
)
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 二维码内容 |
| width | number | 二维码宽度 |
| height | number | 二维码高度 |
| hints | Map | 可选，编码提示 |

## 插件选项

```typescript
interface IBarcode2DOption {
  // 插件配置选项
}
```
