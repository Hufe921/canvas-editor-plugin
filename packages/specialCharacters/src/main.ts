import Editor from '@hufe921/canvas-editor'
import specialCharactersPlugin from './specialCharacters'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(specialCharactersPlugin)

  const openDialogBtn = document.querySelector(
    '#open-dialog'
  ) as HTMLButtonElement
  openDialogBtn.onclick = () => {
    instance.command.executeOpenSpecialCharactersDialog()
  }
}
