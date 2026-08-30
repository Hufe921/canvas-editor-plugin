# Signature

Handwritten signature plugin. Opens a signature board dialog and inserts the signature into the editor as an image on confirm. Supports undo, clear, and exporting as png or svg (default svg).

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-signature
```

## Usage

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

## Parameters

| Parameter  | Type                      | Description                                                                        |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------- |
| width      | number                    | Optional, board width                                                              |
| height     | number                    | Optional, board height                                                             |
| exportType | 'png' \| 'svg'            | Optional, exported image format, default svg                                       |
| locale     | string                    | Optional, dialog language (built-in zhCN and en), defaults to the editor locale    |
| lang       | Partial\<ISignatureLang\> | Optional, overrides the dialog text of the corresponding language                  |
| onClose    | function                  | Optional, dialog close callback                                                    |
| onCancel   | function                  | Optional, cancel callback                                                          |
| onConfirm  | function                  | Optional, confirm callback, inserts the signature image into the editor by default |

## Type Definition

```typescript
interface ISignatureResult {
  // signature image (dataURL)
  value: string
  width: number
  height: number
}

interface ISignatureLang {
  // dialog title text
  titleText: string
  // undo button text
  undoText: string
  // clear button text
  clearText: string
  // cancel button text
  cancelText: string
  // confirm button text
  confirmText: string
}
```

## Example

```javascript
command.executeSignature({
  width: 390,
  height: 180,
  exportType: 'svg',
  onConfirm: payload => {
    console.log('signature result:', payload)
    // payload.value is the signature image dataURL
    // payload.width and payload.height are the image size
  },
  onCancel: () => {
    console.log('user cancelled the signature')
  }
})
```
