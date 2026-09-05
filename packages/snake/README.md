# canvas-editor-plugin-snake

snake game plugin for canvas-editor. 在文档里玩贪吃蛇 🐍

游戏作为 block 元素嵌在文档正文文字流中：点击游戏区开始，方向键 / WASD 控制，失焦自动暂停。
得分与用时通过文本控件**实时同步到文档**（游戏与文档双向通信），「再来一局」即时刷新，
也可以在文档里同时插入多个游戏区。

## Usage

```javascript
import Editor from "@hufe921/canvas-editor"
import snakePlugin from "@hufe921/canvas-editor-plugin-snake"

const instance = new Editor()
instance.use(snakePlugin, {
  width?: number,      // 游戏区宽度，默认 600
  height?: number,     // 游戏区高度，默认 400
  speed?: number,      // 蛇移动间隔 ms，默认 150，越小越快
  theme?: object,      // 蛇 / 食物 / 背景配色
  onGameOver?: (result: { score: number; duration: number }) => void
})

instance.command.executeSnake({ width?, height?, speed? }) // 光标处插入可玩贪吃蛇
```
