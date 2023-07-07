import Editor from '@hufe921/canvas-editor'
import barcode1dPlugin, { CommandWithBarcode1D } from './barcode1d'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(barcode1dPlugin)
  const command = <CommandWithBarcode1D>instance.command

  document.querySelector('button')!.onclick = () => {
    command.executeInsertBarcode1D('12345678', 200, 100)
  }
}
