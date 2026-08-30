import Editor from '@hufe921/canvas-editor'
import mentionPlugin from './mention'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(mentionPlugin, {
    dataList: [
      { id: '1', name: '张三' },
      { id: '2', name: '李四' },
      { id: '3', name: '王五' },
      { id: '4', name: '赵六' },
      { id: '5', name: 'Alice' },
      { id: '6', name: 'Bob' }
    ],
    onSelect: item => {
      console.log('mention select:', item)
    },
    onClick: element => {
      console.log('mention click:', element)
    }
  })

  const openMentionBtn = document.querySelector(
    '#open-mention'
  ) as HTMLButtonElement
  openMentionBtn.onclick = () => {
    instance.command.executeMention()
  }
}
