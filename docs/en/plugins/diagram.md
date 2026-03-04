# Diagram

Integrated diagram drawing plugin, supporting flowcharts, sequence diagrams, etc.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-diagram
```

## Usage

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

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| lang | Lang | Optional, language setting |
| data | string | Optional, initial diagram data |
| onDestroy | function | Optional, close callback function |

## Example

```javascript
command.executeLoadDiagram({
  lang: 'en',
  data: `graph TD
    A[Start] --> B{Decision}
    B -->|Condition 1| C[Process 1]
    B -->|Condition 2| D[Process 2]`,
  onDestroy: (message) => {
    console.log('Diagram editor closed', message)
  }
})
```
