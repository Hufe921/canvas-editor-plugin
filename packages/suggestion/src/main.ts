import Editor from '@hufe921/canvas-editor'
import suggestionPlugin from './suggestion'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(suggestionPlugin, {
    dataList: [
      { id: '1', name: '患者男性，否认药物过敏史' },
      { id: '2', name: '患者女性，既往体健，无高血压、糖尿病等慢性病史' },
      { id: '3', name: '神志清楚，精神可，查体合作' },
      { id: '4', name: '心肺听诊未闻及明显异常' },
      { id: '5', name: '腹部平软，无压痛及反跳痛' },
      { id: '6', name: '双侧瞳孔等大等圆，对光反射灵敏' },
      { id: '7', name: '建议完善血常规、尿常规、生化全套检查' },
      { id: '8', name: '嘱患者清淡饮食，注意休息，不适随诊' }
    ],
    onSelect: item => {
      console.log('suggestion select:', item)
    }
  })

  const openSuggestionBtn = document.querySelector(
    '#open-suggestion'
  ) as HTMLButtonElement
  openSuggestionBtn.onclick = () => {
    instance.command.executeSuggestion()
  }
  ;(window as any).editor = instance
}
