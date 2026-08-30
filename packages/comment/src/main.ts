import Editor from '@hufe921/canvas-editor'
import commentPlugin from './comment'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: [
      {
        value:
          'canvas-editor 批注插件演示。\n选中一段文本，右键选择“添加批注”，批注卡片会显示在右侧批注栏中，并通过连接线与高亮文本关联。\n将光标移入高亮的批注区域，对应卡片与连接线会高亮强调。\n点击批注卡片可定位到批注文本，点击卡片上的“删除批注”按钮或在批注文本上右键可删除批注。\n这是一段用于填充演示的示例文本，可以对其中的任意内容添加多条批注，验证卡片防重叠与滚动重布局的效果。'
      }
    ]
  })
  instance.use(commentPlugin, {
    user: 'demo',
    onAdd: comment => console.log('add comment', comment),
    onRemove: id => console.log('remove comment', id)
  })
}
