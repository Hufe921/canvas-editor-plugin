# Quick Start

Canvas Editor Plugin is a collection of plugins developed for [canvas-editor](https://github.com/hufe921/canvas-editor), providing rich extension features.

## Features

- 🚀 Simple and easy-to-use API
- 📦 Rich plugin ecosystem
- 🔧 Highly customizable
- 💪 TypeScript support

## Installation

Install plugins using pnpm:

```bash
pnpm install @hufe921/canvas-editor-plugin-<name>
```

## Quick Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode1DPlugin from '@hufe921/canvas-editor-plugin-barcode1d'

const instance = new Editor()
instance.use(barcode1DPlugin)

// Use plugin functionality
instance.executeInsertBarcode1D('123456', 200, 100)
```
