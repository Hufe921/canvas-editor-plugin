import Editor from '@hufe921/canvas-editor'
import barcode1dPlugin from './barcode1d'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(barcode1dPlugin)
  const command = instance.command

  document.querySelector('button')!.onclick = () => {
    command.executeInsertBarcode1D('12345678', 200, 100)
  }
}
