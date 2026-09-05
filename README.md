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

- @hufe921/canvas-editor-plugin-mention

```javascript
import Editor from '@hufe921/canvas-editor'
import mentionPlugin from '@hufe921/canvas-editor-plugin-mention'

const instance = new Editor()
instance.use(mentionPlugin, {
  dataList: [{ id: '1', name: '张三' }],
  onSelect?: (item: IMentionItem) => void,
  onClick?: (element: IElement) => void
})

// 程序化唤起候选浮层
instance.command.executeMention()
```

- @hufe921/canvas-editor-plugin-comment

```javascript
import Editor from '@hufe921/canvas-editor'
import commentPlugin from '@hufe921/canvas-editor-plugin-comment'

const instance = new Editor()
instance.use(commentPlugin, {
  highlightColor?: string, // 批注高亮色，默认 #fde7e9
  railWidth?: number, // 右侧批注栏宽度（px），默认 220
  lineColor?: string, // 连接线颜色，默认 #f54a45
  userColor?: string, // 批注卡片作者名颜色，默认 #f54a45
  user?: string, // 当前用户名
  onAdd?: (comment: IComment) => void,
  onRemove?: (id: string) => void
})

instance.command.executeAddComment() // 对当前选区添加批注
instance.command.executeRemoveComment(id?: string) // 删除批注
instance.command.executeGetCommentList() // 获取批注列表
instance.command.executeSetCommentList(list) // 恢复批注列表
```

- @hufe921/canvas-editor-plugin-formula

```javascript
import Editor from '@hufe921/canvas-editor'
import formulaPlugin from '@hufe921/canvas-editor-plugin-formula'

const instance = new Editor()
instance.use(formulaPlugin, {
  isRegisterEditContextMenu?: boolean, // 是否注册公式编辑右键菜单，默认 true
  locale?: string, // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<IFormulaLang> // 覆盖对应语言的弹窗文案
})

instance.executeInsertFormula(latex: string) // 插入行内公式，右键公式可二次编辑
```

- @hufe921/canvas-editor-plugin-chart

```javascript
import Editor from '@hufe921/canvas-editor'
import chartPlugin from '@hufe921/canvas-editor-plugin-chart'

const instance = new Editor()
instance.use(chartPlugin, {
  width?: number, // 插入图表宽度，默认 600
  height?: number, // 插入图表高度，默认 400
  defaultOption?: object, // 打开弹窗时预填的 ECharts option（直接进入高级模式）
  locale?: string, // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<IChartLang>, // 覆盖对应语言的弹窗文案
  onInsert?: (option: object) => void // 插入图表回调，参数为最终生效的 ECharts option
})

instance.command.executeChart({
  width?: number,
  height?: number,
  defaultOption?: object
}) // 打开图表插入弹窗，支持柱状图、折线图、饼图；右键图表可二次编辑
```

- @hufe921/canvas-editor-plugin-suggestion

```javascript
import Editor from '@hufe921/canvas-editor'
import suggestionPlugin from '@hufe921/canvas-editor-plugin-suggestion'

const instance = new Editor()
instance.use(suggestionPlugin, {
  dataList: [{ id: '1', name: '心肌梗死', value: '急性心肌梗死' }], // 候选数据（数组或返回数组的函数），value 缺省时插入 name
  minLength?: number, // 触发联想的最小查询词长度，默认 1
  max?: number, // 候选最多显示条数，默认 5
  match?: 'prefix' | 'contains' | ((query: string, item: ISuggestionItem) => boolean), // 匹配方式，默认 prefix
  onSelect?: (item: ISuggestionItem) => void, // 选中候选项回调
  locale?: string, // 面板语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<ISuggestionLang> // 覆盖对应语言的面板文案
})

instance.command.executeSuggestion() // 程序化唤起候选浮层
```

- @hufe921/canvas-editor-plugin-snake

```javascript
import Editor from '@hufe921/canvas-editor'
import snakePlugin from '@hufe921/canvas-editor-plugin-snake'

const instance = new Editor()
instance.use(snakePlugin, {
  width?: number,      // 游戏区宽度，默认 600
  height?: number,     // 游戏区高度，默认 400
  speed?: number,      // 蛇移动间隔 ms，默认 150，越小越快
  theme?: object,      // 蛇 / 食物 / 背景配色
  onGameOver?: (result: { score: number; duration: number }) => void
})

instance.command.executeSnake({ width?, height?, speed? }) // 光标处插入可玩贪吃蛇
```

游戏嵌在文档正文文字流中，得分与用时通过文本控件实时同步到文档。

- @hufe921/canvas-editor-plugin-typing

```javascript
import Editor from '@hufe921/canvas-editor'
import typingPlugin from '@hufe921/canvas-editor-plugin-typing'

const instance = new Editor()
instance.use(typingPlugin, {
  passages: string[], // 闯关题目（每项一关），由外部传入
  locale?: string, // 界面语言（内置 zhCN、en）
  lang?: object, // 覆盖对应语言的界面文案
  onFinished?: (result: { duration: number; speed: number; accuracy: number; total: number; correct: number; level: number; levelCount: number }) => void
})

instance.command.executeTyping({ passages?, text? }) // 文档末尾插入打字挑战闯关，光标自动落在输入行
```

闯关题目完全由外部传入，打完一关自动追加下一关，全部结束后追加总成绩行；判定行逐字符变绿 / 变红，用时、速度、正确率实时刷新，纯富文本能力驱动（无 iframe），内置中英文界面文案。
