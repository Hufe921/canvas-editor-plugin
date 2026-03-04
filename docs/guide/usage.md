# 使用

## 基本用法

### 1. 引入插件

```javascript
import Editor from '@hufe921/canvas-editor'
import pluginName from '@hufe921/canvas-editor-plugin-<name>'
```

### 2. 注册插件

```javascript
const instance = new Editor()
instance.use(pluginName, options)
```

### 3. 调用插件命令

```javascript
instance.command.executePluginCommand(params)
```

## 完整示例

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode1DPlugin from '@hufe921/canvas-editor-plugin-barcode1d'

// 创建编辑器实例
const instance = new Editor()

// 注册插件
instance.use(barcode1DPlugin)

// 使用插件功能
instance.executeInsertBarcode1D('123456789', 200, 100, {
  format: 'CODE128',
  lineColor: '#000000'
})
```

## 配置选项

不同的插件可能有不同的配置选项，请参考各插件的详细文档。
