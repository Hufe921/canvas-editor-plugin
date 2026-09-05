import Editor from '@hufe921/canvas-editor'
import snakePlugin from './snake'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(snakePlugin, {
    onGameOver: result => {
      console.log('snake game over:', result)
    }
  })
  // 默认插入一条贪吃蛇（成绩控件在游戏区上方）
  instance.command.executeSnake()

  const insertSnakeBtn = document.querySelector(
    '#insert-snake'
  ) as HTMLButtonElement
  insertSnakeBtn.onclick = () => {
    instance.command.executeSnake()
  }
  ;(window as any).editor = instance
}
