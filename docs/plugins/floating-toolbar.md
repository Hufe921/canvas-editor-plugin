# 浮动工具栏

浮动工具栏插件，选中文本时显示快捷操作工具栏。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-floating-toolbar
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import floatingToolbarPlugin from '@hufe921/canvas-editor-plugin-floating-toolbar'

const instance = new Editor()
instance.use(floatingToolbarPlugin)
```

## 说明

该插件无需额外配置，安装后会自动在文本选中时显示浮动工具栏，提供快捷格式化操作。
