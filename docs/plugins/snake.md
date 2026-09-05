# 贪吃蛇

在文档里玩贪吃蛇 🐍。游戏作为 block 元素嵌在文档正文文字流中，点击游戏区即可开始，方向键 / WASD 控制，失焦自动暂停。得分与用时通过文本控件**实时同步到文档**（游戏与文档双向通信，且不打断游戏操作），支持「再来一局」，也可同时插入多个游戏区。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-snake
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import snakePlugin from '@hufe921/canvas-editor-plugin-snake'

const instance = new Editor()
instance.use(snakePlugin, options?: ISnakeOption)

instance.executeSnake(options?: ISnakeGameOption)
```

## 插件选项

```typescript
interface ISnakeOption {
  // 游戏区宽度，默认 600
  width?: number
  // 游戏区高度，默认 400
  height?: number
  // 蛇移动间隔 ms，默认 150，数值越小越快
  speed?: number
  // 蛇 / 食物 / 背景配色
  theme?: ISnakeTheme
  // 游戏结束回调，返回当局得分与用时
  onGameOver?: (result: ISnakeResult) => void
}
```

## 命令参数

```typescript
interface ISnakeGameOption {
  width?: number
  height?: number
  speed?: number
}
```

## 示例

```javascript
instance.command.executeSnake({ width: 500, height: 350 })
```

插入后文档结构为「实时成绩控件 + 游戏区」：游玩过程中控件内的得分与用时随游戏进度实时刷新，游戏结束停在当局成绩，点击游戏内「再来一局」即可重新开始。
