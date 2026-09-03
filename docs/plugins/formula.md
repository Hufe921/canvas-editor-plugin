# 公式

基于 [KaTeX](https://katex.org/) 的 LaTeX 行内公式插件。公式渲染为内嵌字体的 SVG，以图片元素插入文档，尺寸按公式自然大小自动测量。LaTeX 源码随 SVG 图片持久化，选中公式图片后可通过右键菜单「编辑公式」二次编辑。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-formula
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import formulaPlugin from '@hufe921/canvas-editor-plugin-formula'

const instance = new Editor()
instance.use(formulaPlugin, options?: IFormulaOption)

instance.executeInsertFormula(latex: string)
```

## 参数

| 参数  | 类型   | 说明               |
| ----- | ------ | ------------------ |
| latex | string | LaTeX 行内公式内容 |

## 插件选项

```typescript
interface IFormulaOption {
  // 是否注册公式编辑右键菜单，默认 true
  isRegisterEditContextMenu?: boolean
  // 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale?: string
  // 覆盖对应语言的弹窗文案
  lang?: Partial<IFormulaLang>
}
```

## 示例

```javascript
instance.executeInsertFormula('x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')
```
