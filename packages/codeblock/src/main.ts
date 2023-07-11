import Editor from '@hufe921/canvas-editor'
import codeblockPlugin, { CommandWithCodeblock } from './codeblock'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(codeblockPlugin)
  const command = <CommandWithCodeblock>instance.command

  document.querySelector('button')!.onclick = () => {
    command.executeInsertCodeblock('console.log("canvas-editor")')
  }
}
