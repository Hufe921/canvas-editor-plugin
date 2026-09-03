# Formula

LaTeX inline formula plugin based on [KaTeX](https://katex.org/). The formula is rendered as an SVG with embedded fonts and inserted into the document as an image element, with its size automatically measured from the natural dimensions of the formula. The LaTeX source is persisted inside the SVG image, so a formula can be re-edited via the "Edit Formula" context menu after selecting the formula image.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-formula
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import formulaPlugin from '@hufe921/canvas-editor-plugin-formula'

const instance = new Editor()
instance.use(formulaPlugin, options?: IFormulaOption)

instance.executeInsertFormula(latex: string)
```

## Parameters

| Parameter | Type   | Description                  |
| --------- | ------ | ---------------------------- |
| latex     | string | LaTeX inline formula content |

## Plugin Options

```typescript
interface IFormulaOption {
  // whether to register the formula edit context menu, default true
  isRegisterEditContextMenu?: boolean
  // popup language (built-in zhCN, en), defaults to the editor locale
  locale?: string
  // override popup text for the locale
  lang?: Partial<IFormulaLang>
}
```

## Examples

```javascript
instance.executeInsertFormula('x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')
```
