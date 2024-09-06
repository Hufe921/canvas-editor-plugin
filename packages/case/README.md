<h1 align="center">canvas-editor-plugin-case</h1>

<p align="center">uppercase and lowercase plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-case --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import casePlugin from '@hufe921/canvas-editor-plugin-case'

const instance = new Editor()
instance.use(casePlugin)

command.executeUpperCase()

command.executeLowerCase()
```
