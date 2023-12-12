import Editor from '@hufe921/canvas-editor'
import floatingToolbarPlugin from './floatingToolbar'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(floatingToolbarPlugin)
}
