export interface ISnakeTheme {
  background?: string
  gridLine?: string
  snakeHead?: string
  snakeBody?: string
  food?: string
  text?: string
}

export interface ISnakeResult {
  score: number
  duration: number // 秒
}

export interface ISnakeOption {
  width?: number // 游戏区宽度，默认 600
  height?: number // 游戏区高度，默认 400
  speed?: number // 蛇移动间隔 ms，默认 150，数值越小越快
  theme?: ISnakeTheme
  onGameOver?: (result: ISnakeResult) => void
}

export interface ISnakeGameOption {
  width?: number
  height?: number
  speed?: number
}
