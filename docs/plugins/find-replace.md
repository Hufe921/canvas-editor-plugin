# 查找替换

查找替换插件，在编辑器区域顶部居中弹出非模态浮动面板（标题栏可拖拽调整位置），支持查找高亮、上一个/下一个导航、替换与全部替换。

注册插件后自动启用全局快捷键 `Ctrl/Cmd + F` 唤起面板；面板已打开时再次按下会聚焦查找输入框。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-find-replace
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import findReplacePlugin from '@hufe921/canvas-editor-plugin-find-replace'

const instance = new Editor()
instance.use(findReplacePlugin)

command.executeFindReplace({
  locale?: string,
  lang?: Partial<IFindReplaceLang>,
  onClose?: () => void
})
```

## 参数

| 参数    | 类型                        | 说明                                                      |
| ------- | --------------------------- | --------------------------------------------------------- |
| locale  | string                      | 可选，面板语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang    | Partial\<IFindReplaceLang\> | 可选，覆盖对应语言的面板文案                              |
| onClose | function                    | 可选，面板关闭回调                                        |

注册插件时也可传入默认配置：

```javascript
instance.use(findReplacePlugin, {
  locale: 'en',
  lang: {
    replaceAllText: 'Replace All'
  },
  shortcut: false // 是否启用全局快捷键 Ctrl/Cmd + F，默认启用
})
```

## 类型定义

```typescript
interface IFindReplaceLang {
  // 面板标题文案
  titleText: string
  // 查找输入框占位文案
  findPlaceholder: string
  // 替换输入框占位文案
  replacePlaceholder: string
  // 上一个按钮文案
  prevText: string
  // 下一个按钮文案
  nextText: string
  // 替换按钮文案
  replaceText: string
  // 全部替换按钮文案
  replaceAllText: string
  // 区分大小写选项文案
  matchCaseText: string
}
```

## 示例

```javascript
command.executeFindReplace({
  locale: 'zhCN',
  onClose: () => {
    console.log('查找替换面板已关闭')
  }
})
```
