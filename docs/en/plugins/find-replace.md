# Find and Replace

Find and replace plugin. Opens a non-modal floating panel centered at the top of the editor area (draggable via the title bar), supporting search highlight, previous/next navigation, replace and replace all.

The global shortcut `Ctrl/Cmd + F` is registered automatically to open the panel; pressing it again while the panel is open focuses the find input.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-find-replace
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import findReplacePlugin from '@hufe921/canvas-editor-plugin-find-replace'

const instance = new Editor()
instance.use(findReplacePlugin)

command.executeFindReplace({
  locale?: string,
  lang?: Partial<IFindReplaceLang>,
  onClose?: () => void
})
```

## Parameters

| Parameter | Type                        | Description                                                                    |
| --------- | --------------------------- | ------------------------------------------------------------------------------ |
| locale    | string                      | Optional, panel language (built-in zhCN and en), defaults to the editor locale |
| lang      | Partial\<IFindReplaceLang\> | Optional, overrides the panel text of the corresponding language               |
| onClose   | function                    | Optional, panel close callback                                                 |

Default options can also be provided when registering the plugin:

```javascript
instance.use(findReplacePlugin, {
  locale: 'en',
  lang: {
    replaceAllText: 'Replace All'
  },
  shortcut: false // whether to enable the global shortcut Ctrl/Cmd + F, enabled by default
})
```

## Type Definition

```typescript
interface IFindReplaceLang {
  // Panel title text
  titleText: string
  // Find input placeholder
  findPlaceholder: string
  // Replace input placeholder
  replacePlaceholder: string
  // Previous button text
  prevText: string
  // Next button text
  nextText: string
  // Replace button text
  replaceText: string
  // Replace all button text
  replaceAllText: string
  // Match case option text
  matchCaseText: string
}
```

## Example

```javascript
command.executeFindReplace({
  locale: 'en',
  onClose: () => {
    console.log('find and replace panel closed')
  }
})
```
