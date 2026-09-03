import Editor from '@hufe921/canvas-editor'
import chartPlugin from './chart'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(chartPlugin, {
    onInsert: option => {
      console.log('chart insert:', option)
    }
  })

  const openChartBtn = document.querySelector(
    '#open-chart'
  ) as HTMLButtonElement
  openChartBtn.onclick = () => {
    instance.command.executeChart()
  }
  ;(window as any).editor = instance
}
