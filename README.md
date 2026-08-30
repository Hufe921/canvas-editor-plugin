<h1 align="center">canvas-editor-plugin</h1>

<p align="center">plugins for canvas-editor</p>

## plugin list

- @hufe921/canvas-editor-plugin-barcode1d

```javascript
import Editor from "@hufe921/canvas-editor"
import barcode1DPlugin from "@hufe921/canvas-editor-plugin-barcode1d"

const instance = new Editor()
instance.use(barcode1DPlugin)

instance.executeInsertBarcode1D(
  content: string,
  width: number,
  height: number,
  options?: JsBarcode.Options
)
```

- @hufe921/canvas-editor-plugin-barcode2d

```javascript
import Editor from "@hufe921/canvas-editor"
import barcode2DPlugin from "@hufe921/canvas-editor-plugin-barcode2d"

const instance = new Editor()
instance.use(barcode2DPlugin, options?: IBarcode2DOption)

instance.executeInsertBarcode2D(
  content: string,
  width: number,
  height: number,
  hints?: Map<EncodeHintType, any>
)
```

- @hufe921/canvas-editor-plugin-codeblock

```javascript
import Editor from "@hufe921/canvas-editor"
import codeblockPlugin from "@hufe921/canvas-editor-plugin-codeblock"

const instance = new Editor()
instance.use(codeblockPlugin)

instance.executeInsertCodeblock(content: string)
```

- @hufe921/canvas-editor-plugin-docx

```javascript
import Editor from '@hufe921/canvas-editor'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'

const instance = new Editor()
instance.use(docxPlugin)

command.executeImportDocx({
  arrayBuffer: buffer
})

instance.executeExportDocx({
  fileName: string
})
```

- @hufe921/canvas-editor-plugin-excel

```javascript
import Editor from '@hufe921/canvas-editor'
import excelPlugin from '@hufe921/canvas-editor-plugin-excel'

const instance = new Editor()
instance.use(excelPlugin)

command.executeImportExcel({
  arrayBuffer: buffer
})
```

- @hufe921/canvas-editor-plugin-floating-toolbar

```javascript
import Editor from '@hufe921/canvas-editor'
import floatingToolbarPlugin from '@hufe921/canvas-editor-plugin-floating-toolbar'

const instance = new Editor()
instance.use(floatingToolbarPlugin)
```

- @hufe921/canvas-editor-plugin-diagram

```javascript
import Editor from '@hufe921/canvas-editor'
import diagramPlugin from '@hufe921/canvas-editor-plugin-diagram'

const instance = new Editor()
instance.use(diagramPlugin)

command.executeLoadDiagram({
  lang?: Lang
  data?: string
  onDestroy?: (message?: any) => void
})
```

- @hufe921/canvas-editor-plugin-case

```javascript
import Editor from '@hufe921/canvas-editor'
import casePlugin from '@hufe921/canvas-editor-plugin-case'

const instance = new Editor()
instance.use(casePlugin)

command.executeUpperCase()

command.executeLowerCase()
```

- @hufe921/canvas-editor-plugin-special-characters

```javascript
import Editor from '@hufe921/canvas-editor'
import specialCharactersPlugin from '@hufe921/canvas-editor-plugin-special-characters'

const instance = new Editor()
instance.use(specialCharactersPlugin)

command.executeOpenSpecialCharactersDialog({
  characters?: ICharacterCategory[],
  onSelect?: (char: string) => void
})
```

- @hufe921/canvas-editor-plugin-signature

```javascript
import Editor from '@hufe921/canvas-editor'
import signaturePlugin from '@hufe921/canvas-editor-plugin-signature'

const instance = new Editor()
instance.use(signaturePlugin)

command.executeSignature({
  width?: number,
  height?: number,
  exportType?: 'png' | 'svg', // 导出图片格式，默认 svg
  locale?: string, // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<ISignatureLang>, // 覆盖对应语言的弹窗文案
  onClose?: () => void,
  onCancel?: () => void,
  onConfirm?: (payload: ISignatureResult | null) => void
})
```

- @hufe921/canvas-editor-plugin-menstrual-history

```javascript
import Editor from '@hufe921/canvas-editor'
import menstrualHistoryPlugin from '@hufe921/canvas-editor-plugin-menstrual-history'

const instance = new Editor()
instance.use(menstrualHistoryPlugin)

command.executeLoadMenstrualHistory({
  data?: IMenstrualHistoryData,
  onConfirm?: (data: IMenstrualHistoryData & { svg: string; width: number; height: number }) => void,
  onCancel?: () => void
})
```

- @hufe921/canvas-editor-plugin-markdown

```javascript
import Editor from '@hufe921/canvas-editor'
import markdownPlugin from '@hufe921/canvas-editor-plugin-markdown'

const instance = new Editor()
instance.use(markdownPlugin)

// export markdown
const markdown = instance.command.executeExportMarkdown()

// import markdown
instance.command.executeImportMarkdown({
  value: '# Hello World\n\nThis is a **bold** text.'
})
```

- @hufe921/canvas-editor-plugin-spellcheck

```javascript
import Editor from '@hufe921/canvas-editor'
import spellcheckPlugin from '@hufe921/canvas-editor-plugin-spellcheck'

const instance = new Editor()
instance.use(spellcheckPlugin, options?: ISpellcheckPluginOption)

// ignore the given word (case-insensitive)
instance.command.executeSpellcheckIgnoreWord('word')
```

- @hufe921/canvas-editor-plugin-find-replace

```javascript
import Editor from '@hufe921/canvas-editor'
import findReplacePlugin from '@hufe921/canvas-editor-plugin-find-replace'

const instance = new Editor()
instance.use(findReplacePlugin)

instance.command.executeFindReplace({
  locale?: string, // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<IFindReplaceLang>, // 覆盖对应语言的弹窗文案
  onClose?: () => void
})
```
