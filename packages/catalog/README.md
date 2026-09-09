<h1 align="center">canvas-editor-plugin-catalog</h1>

<p align="center">catalog plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-catalog --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import catalogPlugin from '@hufe921/canvas-editor-plugin-catalog'

const instance = new Editor()
instance.use(catalogPlugin, {
  container: document.querySelector('#sidebar') // required, the catalog renders inside and fills it
})
```
