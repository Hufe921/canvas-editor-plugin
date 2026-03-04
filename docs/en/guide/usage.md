# Usage

## Basic Usage

### 1. Import Plugin

```javascript
import Editor from '@hufe921/canvas-editor'
import pluginName from '@hufe921/canvas-editor-plugin-<name>'
```

### 2. Register Plugin

```javascript
const instance = new Editor()
instance.use(pluginName, options)
```

### 3. Call Plugin Command

```javascript
instance.command.executePluginCommand(params)
```

## Complete Example

```javascript
import Editor from '@hufe921/canvas-editor'
import barcode1DPlugin from '@hufe921/canvas-editor-plugin-barcode1d'

// Create editor instance
const instance = new Editor()

// Register plugin
instance.use(barcode1DPlugin)

// Use plugin functionality
instance.executeInsertBarcode1D('123456789', 200, 100, {
  format: 'CODE128',
  lineColor: '#000000'
})
```

## Configuration Options

Different plugins may have different configuration options. Please refer to the detailed documentation for each plugin.
