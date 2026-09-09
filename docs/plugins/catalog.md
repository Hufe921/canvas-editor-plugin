# 目录

目录（大纲）插件。使用时传入挂载容器 DOM，目录渲染到该容器内并填满容器，位置和尺寸完全由外部布局决定（侧边栏、工具区等）。

目录能力：

- **层级缩进**：按标题层级（一至六级）缩进，每行一个标题
- **点击定位**：点击目录项跳转到对应标题
- **滚动跟随**：滚动浏览文档时，自动高亮当前浏览位置所在章节
- **光标联动**：在编辑器内点击或移动光标时，自动高亮光标所在章节
- **自动刷新**：文档内容变化后自动刷新目录（防抖 300ms）

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-catalog
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import catalogPlugin from '@hufe921/canvas-editor-plugin-catalog'

const instance = new Editor()
instance.use(catalogPlugin, {
  container: document.querySelector('#sidebar')
})
```

## 参数

注册插件时传入：

| 参数      | 类型                    | 必填 | 说明                                                  |
| --------- | ----------------------- | ---- | ----------------------------------------------------- |
| container | HTMLElement             | 是   | 挂载容器，目录渲染到该容器内并填满容器                |
| locale    | string                  | 否   | 目录语言（内置 zhCN 和 en），默认取编辑器 locale 配置 |
| lang      | Partial\<ICatalogLang\> | 否   | 覆盖对应语言的目录文案                                |

```javascript
instance.use(catalogPlugin, {
  container: document.querySelector('#sidebar'),
  locale: 'en',
  lang: {
    emptyText: 'No headings yet'
  }
})
```

## 类型定义

```typescript
interface ICatalogLang {
  // 面板标题文案
  titleText: string
  // 无标题时的占位文案
  emptyText: string
}
```

## 说明

- 目录数据来自文档中的标题元素，文档内容变化后自动刷新
- 编辑器销毁（`editor.destroy()`）时自动移除目录与事件监听
