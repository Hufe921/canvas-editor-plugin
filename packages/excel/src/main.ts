import Editor from '@hufe921/canvas-editor'
import excelPlugin from './excel'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(excelPlugin)
  const command = instance.command

  const fileInput = document.querySelector<HTMLInputElement>('#file-excel')!

  document.querySelector<HTMLButtonElement>('#import-excel')!.onclick = () => {
    fileInput.click()
  }

  fileInput.onchange = () => {
    const file = fileInput?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      const buffer = event?.target?.result
      if (buffer instanceof ArrayBuffer) {
        command.executeImportExcel({
          arrayBuffer: buffer
        })
      }
      fileInput.value = ''
    }
    reader.readAsArrayBuffer(file)
  }
}
