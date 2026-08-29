<h1 align="center">canvas-editor-plugin-signature</h1>

<p align="center">signature plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-signature --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import signaturePlugin from '@hufe921/canvas-editor-plugin-signature'

const instance = new Editor()
instance.use(signaturePlugin)

// 打开签名弹窗（默认确认后将签名图片插入编辑器）
instance.command.executeSignature()

// 使用自定义配置
instance.command.executeSignature({
  width: 390,
  height: 180,
  // 导出图片格式：png | svg，默认 svg
  exportType: 'svg',
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale: 'en',
  // 覆盖对应语言的弹窗文案
  lang: {
    confirmText: 'Save'
  },
  onClose: () => {
    console.log('close')
  },
  onCancel: () => {
    console.log('cancel')
  },
  onConfirm: (payload) => {
    console.log('confirm', payload)
  }
})
```
