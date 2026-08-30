# 签名

手写签名插件，弹出签名画板，确认后将签名以图片形式插入编辑器，支持撤销、清空，支持导出 png 或 svg（默认 svg）。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-signature
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import signaturePlugin from '@hufe921/canvas-editor-plugin-signature'

const instance = new Editor()
instance.use(signaturePlugin)

command.executeSignature({
  width?: number,
  height?: number,
  exportType?: 'png' | 'svg',
  locale?: string,
  lang?: Partial<ISignatureLang>,
  onClose?: () => void,
  onCancel?: () => void,
  onConfirm?: (payload: ISignatureResult | null) => void
})
```

## 参数

| 参数       | 类型                      | 说明                                                      |
| ---------- | ------------------------- | --------------------------------------------------------- |
| width      | number                    | 可选，画板宽度                                            |
| height     | number                    | 可选，画板高度                                            |
| exportType | 'png' \| 'svg'            | 可选，导出图片格式，默认 svg                              |
| locale     | string                    | 可选，弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang       | Partial\<ISignatureLang\> | 可选，覆盖对应语言的弹窗文案                              |
| onClose    | function                  | 可选，弹窗关闭回调                                        |
| onCancel   | function                  | 可选，取消回调                                            |
| onConfirm  | function                  | 可选，确认回调，默认将签名图片插入编辑器                  |

## 类型定义

```typescript
interface ISignatureResult {
  // 签名图片（dataURL）
  value: string
  width: number
  height: number
}

interface ISignatureLang {
  // 弹窗标题文案
  titleText: string
  // 撤销按钮文案
  undoText: string
  // 清空按钮文案
  clearText: string
  // 取消按钮文案
  cancelText: string
  // 确定按钮文案
  confirmText: string
}
```

## 示例

```javascript
command.executeSignature({
  width: 390,
  height: 180,
  exportType: 'svg',
  onConfirm: payload => {
    console.log('签名结果:', payload)
    // payload.value 为签名图片 dataURL
    // payload.width 和 payload.height 是图片尺寸
  },
  onCancel: () => {
    console.log('用户取消了签名')
  }
})
```
