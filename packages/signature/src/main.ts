import Editor from '@hufe921/canvas-editor'
import signaturePlugin from './signature'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(signaturePlugin)

  const openDialogBtn = document.querySelector(
    '#open-dialog'
  ) as HTMLButtonElement
  openDialogBtn.onclick = () => {
    instance.command.executeSignature()
  }
}
