<h1 align="center">canvas-editor-plugin-find-replace</h1>

<p align="center">find and replace plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-find-replace --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import findReplacePlugin from '@hufe921/canvas-editor-plugin-find-replace'

const instance = new Editor()
instance.use(findReplacePlugin)

// 打开查找替换浮动面板
instance.command.executeFindReplace()

// 快捷键 Ctrl/Cmd + F 唤起面板（面板已打开时聚焦查找输入框）

// 使用自定义配置
instance.command.executeFindReplace({
  // 面板语言（内置 zhCN、en），默认取编辑器 locale 配置
  locale: 'en',
  // 覆盖对应语言的面板文案
  lang: {
    replaceAllText: 'Replace All'
  },
  onClose: () => {
    console.log('close')
  }
})

// 也可以在注册插件时提供默认配置
instance.use(findReplacePlugin, {
  locale: 'en',
  // 是否启用全局快捷键 Ctrl/Cmd + F，默认启用
  shortcut: false
})
```
