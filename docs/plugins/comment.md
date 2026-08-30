# 批注

批注插件，基于编辑器成组（group）机制实现，Word 同款展示样式：批注范围以高亮色标记，编辑器右侧批注栏显示批注卡片，高亮文本与卡片之间以连接线（虚线斜连）相连，光标所在批注的卡片与连接线高亮强调。支持右键菜单添加/删除批注，点击卡片定位到对应文本。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-comment
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import commentPlugin from '@hufe921/canvas-editor-plugin-comment'

const instance = new Editor()
instance.use(commentPlugin, {
  highlightColor?: string,
  railWidth?: number,
  lineColor?: string,
  userColor?: string,
  user?: string,
  locale?: string,
  lang?: Partial<ICommentLang>,
  onAdd?: (comment: IComment) => void,
  onRemove?: (id: string) => void
})
```

## 命令

```javascript
// 对当前选区添加批注（弹出输入卡片）
command.executeAddComment()

// 删除批注，不传 id 时删除当前光标命中的批注
command.executeRemoveComment(id?: string)

// 获取批注列表（用于持久化）
const list = command.executeGetCommentList()

// 恢复批注列表（需与文档中的 groupId 对应）
command.executeSetCommentList(list)
```

## 参数

| 参数           | 类型                    | 说明                                                      |
| -------------- | ----------------------- | --------------------------------------------------------- |
| highlightColor | string                  | 可选，批注高亮色，默认 `#fde7e9`                          |
| railWidth      | number                  | 可选，右侧批注栏宽度（px），默认 220                      |
| lineColor      | string                  | 可选，连接线颜色，默认 `#f54a45`                          |
| userColor      | string                  | 可选，批注卡片作者名颜色，默认 `#f54a45`                  |
| user           | string                  | 可选，当前用户名（写入批注元数据）                        |
| locale         | string                  | 可选，弹层语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang           | Partial\<ICommentLang\> | 可选，覆盖对应语言的弹层文案                              |
| onAdd          | function                | 可选，批注新增回调                                        |
| onRemove       | function                | 可选，批注删除回调                                        |

## 类型定义

```typescript
interface IComment {
  // 批注 id，即编辑器成组 groupId
  id: string
  content: string
  createdAt: string
  user?: string
}

interface ICommentLang {
  // 右键菜单-添加批注
  addCommentText: string
  // 右键菜单/卡片按钮-删除批注
  removeCommentText: string
  // 批注输入占位符
  placeholderText: string
  // 确认按钮文案
  confirmText: string
  // 取消按钮文案
  cancelText: string
}
```

## 说明

- 批注范围通过编辑器 group 标记，批注元数据（内容/作者/时间）由插件内存维护；持久化时请通过 `executeGetCommentList` / `executeSetCommentList` 与文档数据一并保存。
- 文档内容变更导致批注范围被删除时，插件会自动清理对应的批注元数据。
- 批注栏（rail）渲染在编辑器根容器中、页面右侧的空白区域（无需预留宽度，不会遮挡正文）；根容器宽度不足以容纳批注栏时，以半透明浮层形式覆盖显示。

## 示例

```javascript
instance.use(commentPlugin, {
  user: '张三',
  onAdd: comment => {
    console.log('新增批注', comment)
  },
  onRemove: id => {
    console.log('删除批注', id)
  }
})
```
