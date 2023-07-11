<h1 align="center">canvas-editor-plugin-codeblock</h1>

<p align="center">codeblock plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-codeblock --save
```

```javascript
import Editor from "@hufe921/canvas-editor"
import codeblockPlugin from "@hufe921/canvas-editor-plugin-codeblock"

const instance = new Editor()
instance.use(codeblockPlugin)

instance.executeInsertCodeblock(content: string)
```
