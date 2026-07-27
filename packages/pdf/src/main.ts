import Editor from '@hufe921/canvas-editor'
import pdfPlugin from './pdf'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(pdfPlugin)
  const command = instance.command

  document.querySelector<HTMLButtonElement>('#export-pdf')!.onclick = () => {
    command.executeExportPdf({
      fileName: 'canvas-editor.pdf',
      pdfOptions: {
        loadDefaultFonts: true
      }
    })
  }
}
