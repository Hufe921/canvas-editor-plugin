# 图表绘制

集成图表绘制功能的插件，支持流程图、时序图等。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-diagram
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import diagramPlugin from '@hufe921/canvas-editor-plugin-diagram'

const instance = new Editor()
instance.use(diagramPlugin)

command.executeLoadDiagram({
  lang?: Lang
  data?: string
  onDestroy?: (message?: any) => void
})
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| lang | Lang | 可选，语言设置 |
| data | string | 可选，初始图表数据 |
| onDestroy | function | 可选，关闭回调函数 |

## 示例

```javascript
command.executeLoadDiagram({
  lang: 'zh',
  data: `graph TD
    A[开始] --> B{判断}
    B -->|条件1| C[处理1]
    B -->|条件2| D[处理2]`,
  onDestroy: (message) => {
    console.log('图表编辑器关闭', message)
  }
})
```
