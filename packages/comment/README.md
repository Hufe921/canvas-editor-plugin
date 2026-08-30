# canvas-editor-plugin-comment

comment plugin for canvas-editor

## usage

```bash
npm install @hufe921/canvas-editor-plugin-comment --save
```

```typescript
import Editor from '@hufe921/canvas-editor'
import commentPlugin from '@hufe921/canvas-editor-plugin-comment'

const instance = new Editor(container, {
  main: []
})
instance.use(commentPlugin, {
  user: 'demo',
  onAdd: comment => console.log(comment),
  onRemove: id => console.log(id)
})

// 对当前选区添加批注
instance.command.executeAddComment()
// 删除批注（不传 id 时取当前光标命中的批注）
instance.command.executeRemoveComment(id)
// 获取批注列表
instance.command.executeGetCommentList()
// 恢复批注列表
instance.command.executeSetCommentList(list)
```
