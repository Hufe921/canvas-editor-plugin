# @提及

@提及插件，输入触发符（默认 `@`）后在光标处弹出候选浮层，输入文本实时过滤候选，点击候选项将 `@查询词` 整段替换为不可拆分的提及标签（基于编辑器 LABEL 元素，整体删除）。点击已插入的提及标签可触发回调。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-mention
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import mentionPlugin from '@hufe921/canvas-editor-plugin-mention'

const instance = new Editor()
instance.use(mentionPlugin, {
  dataList: [
    { id: '1', name: '张三' },
    { id: '2', name: '李四' }
  ],
  onSelect?: (item: IMentionItem) => void,
  onClick?: (element: IElement) => void
})

// 程序化在光标处唤起候选浮层
command.executeMention()
```

## 参数

| 参数     | 类型                                   | 说明                                                      |
| -------- | -------------------------------------- | --------------------------------------------------------- |
| trigger  | string                                 | 可选，触发符，默认 `@`                                    |
| dataList | IMentionItem[] \| () => IMentionItem[] | 必填，候选数据（数组或返回数组的函数）                    |
| onSelect | function                               | 可选，选中候选项回调                                      |
| onClick  | function                               | 可选，点击已插入提及标签回调                              |
| label    | IMentionLabelStyle                     | 可选，提及标签样式覆盖                                    |
| max      | number                                 | 可选，候选最多显示条数，默认 5                            |
| locale   | string                                 | 可选，面板语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang     | Partial\<IMentionLang\>                | 可选，覆盖对应语言的面板文案                              |

## 类型定义

```typescript
interface IMentionItem {
  id: string
  name: string
  [key: string]: any
}

interface IMentionLabelStyle {
  color?: string
  backgroundColor?: string
  borderRadius?: number
  padding?: [number, number, number, number]
}

interface IMentionLang {
  // 无匹配候选时的空态文案
  emptyText: string
  // 候选面板提示文案
  placeholderText: string
}
```

## 说明

- 候选浮层为鼠标点击选择，暂不支持方向键导航（编辑器核心未暴露按键钩子）。
- 触发符被删除或光标移回触发符之前时，浮层自动关闭。

## 示例

```javascript
instance.use(mentionPlugin, {
  dataList: () => fetchUserList(),
  label: {
    color: '#347ef2',
    backgroundColor: '#f2f6fc'
  },
  onSelect: item => {
    console.log('选中', item)
  }
})
```
