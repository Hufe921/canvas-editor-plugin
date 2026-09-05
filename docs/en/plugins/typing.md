# Typing Challenge

Take a typing challenge right inside your document ⌨️. The plugin appends "sample text + feedback line + live stats + input line" to the end of the document and places the cursor on the input line automatically. Type along with the sample text: the feedback line turns green / red character by character, while duration, speed and accuracy stream into the stats bar. Finishing a stage triggers the 🎉 done state and the result callback. Stage passages are provided entirely from the outside. Multi-stage progression is supported (the next stage is appended automatically when one is cleared) as well as single-stage practice; after the final stage a bold run-summary line (total duration, average speed, average accuracy) is appended. The whole game is powered purely by the editor's rich text engine (per-keystroke content events + character-level coloring + text controls) — no iframe involved. UI text ships in Chinese and English and can be customized.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-typing
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import typingPlugin from '@hufe921/canvas-editor-plugin-typing'

const instance = new Editor()
instance.use(typingPlugin, options?: ITypingOption)

instance.command.executeTyping(options?: ITypingGameOption)
```

## Plugin Options

```typescript
interface ITypingOption {
  passages?: string[] // stage passages (one per stage), provided from outside, required
  locale?: string // UI language (built-in zhCN, en), defaults to the editor locale
  lang?: Partial<ITypingLang> // override UI text for the locale
  onFinished?: (result: ITypingResult) => void // called when a stage is finished with the round result
}

interface ITypingResult {
  duration: number // duration in seconds
  speed: number // speed in characters per minute
  accuracy: number // accuracy (0-100)
  total: number // total characters of the stage passage
  correct: number // correctly typed characters
  level: number // current stage (1-based)
  levelCount: number // total stages
}
```

## Command Options

```typescript
interface ITypingGameOption {
  passages?: string[] // stage passages for this call, higher priority than plugin-level passages
  text?: string // single custom passage, lower priority than passages
  locale?: string
  lang?: Partial<ITypingLang>
}
```

## Example

```javascript
// progression with the passages configured on the plugin
instance.command.executeTyping()

// passages for this call
instance.command.executeTyping({
  passages: ['纸上得来终觉浅，绝知此事要躬行。']
})

// English UI + English passage
instance.command.executeTyping({
  locale: 'en',
  passages: ['Actions speak louder than words.']
})
```

Each stage renders as "title / sample / feedback line / stats bar / input line": the sample lives in a disabled text control so the game data cannot be edited even if the cursor wanders in; the feedback line starts as a light-gray mirror of the passage; typed characters turn green when correct and red when wrong (showing what you actually typed), and backspace rolls back. The stats bar refreshes duration, speed and accuracy in real time; finishing a stage shows 🎉, reports through `onFinished`, then the next stage is appended automatically with the cursor handed over to the new input line. After the last stage, a bold "🏆 run summary" line is appended with total duration, average speed and average accuracy.
