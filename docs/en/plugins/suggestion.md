# Suggestion

Suggestion plugin: while typing, it extracts the query before the cursor, matches candidate phrases in real time and shows them in a dropdown panel; selecting a candidate replaces the typed query with the full phrase. Arrow keys navigate candidates, Enter/Tab selects, Escape closes, and the panel can also be opened programmatically via a command.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-suggestion
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import suggestionPlugin from '@hufe921/canvas-editor-plugin-suggestion'

const instance = new Editor()
instance.use(suggestionPlugin, {
  dataList: [
    { id: '1', name: 'No known drug allergies' },
    { id: '2', name: 'No obvious abnormality on cardiopulmonary auscultation' }
  ],
  onSelect: item => {
    console.log(item)
  }
})

// Programmatically open the candidate panel (no query tracking, insert directly on select)
command.executeSuggestion()
```

## Options

| Option    | Type                                        | Description                                                             |
| --------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| dataList  | ISuggestionItem[] \| () => ISuggestionItem[] | Required, candidate data (array or a function returning an array)       |
| minLength | number                                      | Optional, minimum query length to trigger suggestion, default 1         |
| max       | number                                      | Optional, maximum number of candidates shown, default 5                 |
| match     | 'prefix' \| 'contains' \| function          | Optional, match mode, default `prefix`; built-in modes are case-insensitive |
| onSelect  | function                                    | Optional, callback when a candidate is selected                         |
| locale    | string                                      | Optional, panel language (built-in zhCN, en), defaults to editor locale |
| lang      | Partial\<ISuggestionLang\>                  | Optional, override panel texts of the corresponding language            |

## Type Definitions

```typescript
interface ISuggestionItem {
  id: string
  name: string
  // Phrase actually inserted on select; `name` is inserted when omitted
  value?: string
  [key: string]: any
}

// Match mode: prefix, contains, or a custom matcher (built-in modes are case-insensitive)
type ISuggestionMatch =
  | 'prefix'
  | 'contains'
  | ((query: string, item: ISuggestionItem) => boolean)

interface ISuggestionLang {
  // Empty text when no candidate matches
  emptyText: string
}
```

## Example

```javascript
instance.use(suggestionPlugin, {
  dataList: () => fetchPhraseList(),
  max: 8,
  match: 'contains',
  onSelect: item => {
    console.log('selected', item)
  }
})
```
