# 快速开始

Canvas Editor Plugin 是为 [canvas-editor](https://github.com/hufe921/canvas-editor) 开发的插件集合，提供了丰富的扩展功能。

## 特性

- 🚀 简单易用的 API
- 📦 丰富的插件生态
- 🔧 高度可定制
- 💪 TypeScript 支持

## 安装

使用 pnpm 安装插件：

```bash
pnpm install @hufe921/canvas-editor-plugin-<name>
```

## 快速使用

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode1DPlugin from '@hufe921/canvas-editor-plugin-barcode1d'

const instance = new Editor()
instance.use(barcode1DPlugin)

// 使用插件功能
instance.executeInsertBarcode1D('123456', 200, 100)
```
