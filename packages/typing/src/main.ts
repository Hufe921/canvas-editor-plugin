import Editor from '@hufe921/canvas-editor'
import typingPlugin from './typing'

// dev 页示例题目：题目由外部传入，插件本身不内置内容
const passages = [
  '千里之行，始于足下。',
  'Well begun is half done.',
  '不积跬步，无以至千里；不积小流，无以成江海。',
  'Actions speak louder than words.',
  'The quick brown fox jumps over the lazy dog.'
]

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(typingPlugin, {
    passages,
    onFinished: result => {
      console.log('typing finished:', result)
    }
  })
  // 默认插入一场打字挑战（光标自动落到输入行）
  instance.command.executeTyping()

  const insertTypingBtn = document.querySelector(
    '#insert-typing'
  ) as HTMLButtonElement
  insertTypingBtn.onclick = () => {
    instance.command.executeTyping()
  }
  ;(window as any).editor = instance
}
