import Editor from '@hufe921/canvas-editor'
import findReplacePlugin from './findReplace'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(findReplacePlugin)

  const openDialogBtn = document.querySelector(
    '#open-dialog'
  ) as HTMLButtonElement
  openDialogBtn.onclick = () => {
    instance.command.executeFindReplace()
  }
}
