import Editor from '@hufe921/canvas-editor'
import docxPlugin, { CommandWithDocx } from './docx'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(docxPlugin)
  const command = <CommandWithDocx>instance.command

  document.querySelector('button')!.onclick = () => {
    command.executeExportDocx({
      fileName: 'canvas-editor'
    })
  }
}
