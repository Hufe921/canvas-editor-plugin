# Snake

Play Snake right inside your document 🐍. The game is embedded in the document text flow as a block element — click the game area to start, control with arrow keys / WASD, auto-pauses on blur. Score and time are synced to the document **in real time** through a text control (two-way communication between game and document, without interrupting gameplay). "Play Again" restarts instantly, and multiple game areas can coexist in one document.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-snake
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import snakePlugin from '@hufe921/canvas-editor-plugin-snake'

const instance = new Editor()
instance.use(snakePlugin, options?: ISnakeOption)

instance.executeSnake(options?: ISnakeGameOption)
```

## Plugin Options

```typescript
interface ISnakeOption {
  // game area width, default 600
  width?: number
  // game area height, default 400
  height?: number
  // snake movement interval in ms, default 150, smaller is faster
  speed?: number
  // snake / food / background colors
  theme?: ISnakeTheme
  // game over callback with the score and duration of the round
  onGameOver?: (result: ISnakeResult) => void
}
```

## Command Options

```typescript
interface ISnakeGameOption {
  width?: number
  height?: number
  speed?: number
}
```

## Example

```javascript
instance.command.executeSnake({ width: 500, height: 350 })
```

After insertion the document contains a "live score control + game area": while playing, the score and duration inside the control refresh in real time with the game and stop at the final result when the round ends. Click "Play Again" inside the game to restart.
