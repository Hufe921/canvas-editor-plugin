# Code Block

Code block syntax highlighting plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-codeblock
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import codeblockPlugin from '@hufe921/canvas-editor-plugin-codeblock'

const instance = new Editor()
instance.use(codeblockPlugin)

instance.executeInsertCodeblock(content: string)
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| content | string | Code content |

## Example

```javascript
instance.executeInsertCodeblock(`function hello() {
  console.log('Hello World');
}`)
```
