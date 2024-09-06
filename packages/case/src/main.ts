import Editor, { Command } from '@hufe921/canvas-editor'
import casePlugin from './case'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(casePlugin)
  instance.register.contextMenuList([
    {
      name: '转成大写',
      when: payload => {
        return !payload.isReadonly && payload.editorHasSelection
      },
      callback: (command: Command) => {
        command.executeUpperCase()
      }
    },
    {
      name: '转成小写',
      when: payload => {
        return !payload.isReadonly && payload.editorHasSelection
      },
      callback: (command: Command) => {
        command.executeLowerCase()
      }
    }
  ])
}
