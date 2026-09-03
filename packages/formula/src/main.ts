import Editor from '@hufe921/canvas-editor'
import formulaPlugin from './formula'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(formulaPlugin)
  const command = instance.command

  document.querySelector('button')!.onclick = () => {
    const latex = document.querySelector<HTMLTextAreaElement>('textarea')!.value
    command.executeInsertFormula(latex)
  }
}
