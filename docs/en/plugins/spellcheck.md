# Spellcheck

Spellcheck plugin. It validates English words in the document against the cspell English dictionary, underlines misspelled words, and shows suggestions on click for one-click replacement or ignoring.

> Requires `@hufe921/canvas-editor` >= 1.0.2

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-spellcheck
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import spellcheckPlugin from '@hufe921/canvas-editor-plugin-spellcheck'

const instance = new Editor(
  container,
  {
    main: [
      {
        value: 'Hello world'
      }
    ]
  },
  {
    spellcheck: {
      color: '#f54a45' // underline color of misspelled words
    }
  }
)
instance.use(spellcheckPlugin, {
  suggestionCount: 5,
  ignoreWords: ['canvas-editor']
})
```

## Options

| Name | Description | Type | Default |
| --- | --- | --- | --- |
| disabled | Disable spellcheck | boolean | false |
| suggestionCount | Number of suggestion candidates | number | 3 |
| suggestionTimeout | Suggestion generation timeout (ms) | number | 100 |
| ignoreWords | Ignored word list (case-insensitive) | string[] | [] |
| minWordLength | Minimum word length to check | number | 1 |
| locale | Popup language (built-in zhCN and en), defaults to the editor locale option | string | - |
| lang | Override popup texts of the selected language | Partial&lt;ISpellcheckLang&gt; | - |

## i18n

The plugin ships with `zhCN` and `en` popup languages. It follows the editor `locale` option by default; you can also set `locale` explicitly or override any text via `lang`:

```typescript
interface ISpellcheckLang {
  ignoreText: string // Ignore button text in popup
  emptyText: string // Empty suggestion text in popup
}
```

```javascript
instance.use(spellcheckPlugin, {
  locale: 'en',
  lang: {
    emptyText: 'No suggestions'
  }
})
```

## Command

```javascript
// Ignore the given word (case-insensitive) and refresh marks immediately
instance.command.executeSpellcheckIgnoreWord('word')
```
