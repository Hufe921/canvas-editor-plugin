import Editor from '@hufe921/canvas-editor'
import codeblockPlugin from './codeblock'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(codeblockPlugin)
  const command = instance.command

  document.querySelector('button')!.onclick = () => {
    command.executeInsertCodeblock('console.log("canvas-editor")')
  }
}
