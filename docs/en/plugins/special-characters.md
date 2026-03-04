# Special Characters

Special character selection dialog plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-special-characters
```

## Usage

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

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| characters | ICharacterCategory[] | Optional, custom character categories |
| onSelect | function | Optional, callback when character is selected |

## Type Definition

```typescript
interface ICharacterCategory {
  name: string
  characters: string[]
}
```

## Example

```javascript
command.executeOpenSpecialCharactersDialog({
  characters: [
    {
      name: 'Math Symbols',
      characters: ['±', '×', '÷', '∞', '∑', '∏']
    },
    {
      name: 'Currency Symbols',
      characters: ['$', '€', '£', '¥', '₩', '₽']
    }
  ],
  onSelect: (char) => {
    console.log('Selected character:', char)
  }
})
```
