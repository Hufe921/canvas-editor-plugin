import Editor, {
  Command,
  ElementType,
  IContextMenuContext
} from '@hufe921/canvas-editor'
import menstrualHistoryPlugin, {
  PLUGIN_NAME,
  IMenstrualHistoryData
} from './menstrualHistory'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })

  instance.use(menstrualHistoryPlugin)

  // 固定的显示高度
  const DISPLAY_HEIGHT = 30

  // 注册右键菜单
  instance.register.contextMenuList([
    {
      name: '插入月经史',
      when: payload => {
        return !payload.isReadonly && payload.editorTextFocus
      },
      callback: (command: Command) => {
        command.executeLoadMenstrualHistory({
          onConfirm: result => {
            const { svg, width, height, ...data } = result
            // 根据固定高度等比例计算宽度
            const displayWidth = Math.round((width / height) * DISPLAY_HEIGHT)
            command.executeInsertElementList([
              {
                type: ElementType.IMAGE,
                width: displayWidth,
                height: DISPLAY_HEIGHT,
                value: svg,
                extension: {
                  name: PLUGIN_NAME,
                  data
                }
              }
            ])
          }
        })
      }
    },
    {
      name: '编辑月经史',
      when: payload => {
        const extension = payload.startElement?.extension as any
        return (
          !payload.isReadonly &&
          payload.editorTextFocus &&
          extension?.name === PLUGIN_NAME
        )
      },
      callback: (command: Command, context: IContextMenuContext) => {
        const extension = context.startElement?.extension as any
        const data = extension?.data as IMenstrualHistoryData

        command.executeLoadMenstrualHistory({
          data,
          onConfirm: result => {
            const { svg, width, height, ...newData } = result
            // 根据固定高度等比例计算宽度
            const displayWidth = Math.round((width / height) * DISPLAY_HEIGHT)
            command.executeUpdateElementById({
              id: context.startElement!.id!,
              properties: {
                width: displayWidth,
                height: DISPLAY_HEIGHT,
                value: svg,
                extension: {
                  name: PLUGIN_NAME,
                  data: newData
                }
              }
            })
          }
        })
      }
    }
  ])
}
