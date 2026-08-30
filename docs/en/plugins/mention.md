# Mention

Mention plugin: typing the trigger character (default `@`) pops up a candidate panel near the cursor; subsequent typing filters the candidates in real time, and clicking a candidate replaces the whole `@query` text with an atomic mention label (based on the editor's LABEL element, deleted as a whole). Clicking an inserted mention label fires a callback.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-mention
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import mentionPlugin from '@hufe921/canvas-editor-plugin-mention'

const instance = new Editor()
instance.use(mentionPlugin, {
  dataList: [
    { id: '1', name: 'John' },
    { id: '2', name: 'Jane' }
  ],
  onSelect?: (item: IMentionItem) => void,
  onClick?: (element: IElement) => void
})

// Programmatically open the candidate panel at the cursor
command.executeMention()
```

## Options

| Option   | Type                                   | Description                                                             |
| -------- | -------------------------------------- | ----------------------------------------------------------------------- |
| trigger  | string                                 | Optional, trigger character, default `@`                                |
| dataList | IMentionItem[] \| () => IMentionItem[] | Required, candidate data (array or a function returning an array)       |
| onSelect | function                               | Optional, callback when a candidate is selected                         |
| onClick  | function                               | Optional, callback when an inserted mention label is clicked            |
| label    | IMentionLabelStyle                     | Optional, mention label style override                                  |
| max      | number                                 | Optional, maximum number of candidates shown, default 5                 |
| locale   | string                                 | Optional, panel language (built-in zhCN, en), defaults to editor locale |
| lang     | Partial\<IMentionLang\>                | Optional, override panel texts of the corresponding language            |

## Type Definitions

```typescript
interface IMentionItem {
  id: string
  name: string
  [key: string]: any
}

interface IMentionLabelStyle {
  color?: string
  backgroundColor?: string
  borderRadius?: number
  padding?: [number, number, number, number]
}

interface IMentionLang {
  // Empty text when no candidate matches
  emptyText: string
  // Candidate panel placeholder text
  placeholderText: string
}
```

## Notes

- Candidates are selected by mouse click; arrow-key navigation is not supported yet (the editor core does not expose a keydown hook for plugins).
- The panel closes automatically when the trigger character is deleted or the cursor moves back before it.

## Example

```javascript
instance.use(mentionPlugin, {
  dataList: () => fetchUserList(),
  label: {
    color: '#347ef2',
    backgroundColor: '#f2f6fc'
  },
  onSelect: item => {
    console.log('selected', item)
  }
})
```
