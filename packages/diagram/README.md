<h1 align="center">canvas-editor-plugin-diagram</h1>

<p align="center">diagram plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-diagram --save
```

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
