<h1 align="center">canvas-editor-plugin-formula</h1>

<p align="center">formula plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-formula --save
```

```javascript
import Editor from "@hufe921/canvas-editor"
import formulaPlugin from "@hufe921/canvas-editor-plugin-formula"

const instance = new Editor()
instance.use(formulaPlugin, {
  isRegisterEditContextMenu?: boolean // 是否注册公式编辑右键菜单，默认 true
  locale?: string, // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<IFormulaLang> // 覆盖对应语言的弹窗文案
})

instance.executeInsertFormula(latex: string) // 插入行内公式
```

基于 [KaTeX](https://katex.org/) 渲染 LaTeX 行内公式，以 SVG 图片形式插入文档，尺寸按公式自然大小自动测量。LaTeX 源码随 SVG 图片持久化，选中公式图片后可通过右键菜单二次编辑。
