import Editor from '@hufe921/canvas-editor'
import docxPlugin from './docx'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(docxPlugin)
  const command = instance.command

  document.querySelector('button')!.onclick = () => {
    command.executeExportDocx({
      fileName: 'canvas-editor'
    })
  }
}
