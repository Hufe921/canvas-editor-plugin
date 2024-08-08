import Editor, {
  Command,
  ElementType,
  IContextMenuContext
} from '@hufe921/canvas-editor'
import diagramPlugin from './diagram'

const PLUGIN_NAME = 'diagram'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })
  instance.use(diagramPlugin)
  instance.register.contextMenuList([
    {
      name: '打开/编辑流程图',
      when: payload => {
        return !payload.isReadonly && payload.editorTextFocus
      },
      callback: (command: Command, context: IContextMenuContext) => {
        const extension = <any>context.startElement?.extension
        const data = extension?.name === PLUGIN_NAME ? extension.xml : ''
        command.executeLoadDiagram({
          data,
          onDestroy: message => {
            if (!message || !message.data) return
            const { bounds } = message
            if (!data) {
              // 新增
              command.executeInsertElementList([
                {
                  type: ElementType.IMAGE,
                  width: bounds.width,
                  height: bounds.height,
                  value: message.data,
                  extension: {
                    name: PLUGIN_NAME,
                    xml: message.xml
                  }
                }
              ])
            } else {
              // 更新
              command.executeUpdateElementById({
                id: context.startElement!.id!,
                properties: {
                  width: bounds.width,
                  height: bounds.height,
                  value: message.data,
                  extension: {
                    name: PLUGIN_NAME,
                    xml: message.xml
                  }
                }
              })
            }
          }
        })
      }
    }
  ])
}
