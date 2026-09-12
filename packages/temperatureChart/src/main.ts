import Editor from '@hufe921/canvas-editor'
import temperatureChartPlugin from './temperatureChart'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(temperatureChartPlugin)

  const openBtn = document.querySelector(
    '#open-temperature-chart'
  ) as HTMLButtonElement
  openBtn.onclick = () => {
    instance.command.executeTemperatureChart()
  }
  ;(window as any).editor = instance
}
