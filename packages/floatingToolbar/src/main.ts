import Editor from '@hufe921/canvas-editor'
import floatingToolbarPlugin from './floatingToolbar'
import { IFloatingToolbarOptions } from './floatingToolbar/interface'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: []
  })

  // 定义自定义工具栏配置
  const toolbarOptions: IFloatingToolbarOptions = {
    // 是否显示默认工具栏项，默认为true
    showDefaultItems: true,

    // 自定义工具栏项
    customItems: [
      // 添加一个分隔符
      {
        isDivider: true,
        key: 'divider-1' // key对分隔符可选
      },
      {
        key: 'custom-ai-polish',
        title: 'AI润色',
        // 使用CSS类作为图标（以.开头表示类名）
        icon: '.icon-ai-polish',
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        callback: _editor => {
          alert('AI润色功能尚未实现')
        }
      },
      {
        key: 'custom-text-icon',
        title: '文本图标示例',
        // 使用文本作为图标（不以.或#开头即为文本）
        icon: 'T',
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        callback: _editor => {
          alert('使用文本作为图标示例')
        }
      }
    ]
  }

  // 使用带有自定义选项的浮动工具栏插件)
  instance.use(floatingToolbarPlugin, toolbarOptions)
}
