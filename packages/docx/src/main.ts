import Editor from '@hufe921/canvas-editor'
import docxPlugin from './docx'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(docxPlugin)
  const command = instance.command

  const fileInput = document.querySelector<HTMLInputElement>('#file-docx')!

  document.querySelector<HTMLButtonElement>('#import-docx')!.onclick = () => {
    fileInput.click()
  }

  fileInput.onchange = () => {
    const file = fileInput?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      const buffer = event?.target?.result
      if (buffer instanceof ArrayBuffer) {
        command.executeImportDocx({
          arrayBuffer: buffer
        })
      }
      fileInput.value = ''
    }
    reader.readAsArrayBuffer(file)
  }

  document.querySelector<HTMLButtonElement>('#export-docx')!.onclick = () => {
    command.executeExportDocx({
      fileName: 'canvas-editor'
    })
  }
}
