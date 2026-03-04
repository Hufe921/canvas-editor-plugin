# Case Converter

Text case conversion plugin.

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-case
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import casePlugin from '@hufe921/canvas-editor-plugin-case'

const instance = new Editor()
instance.use(casePlugin)
```

## Commands

### Convert to Uppercase

```javascript
command.executeUpperCase()
```

### Convert to Lowercase

```javascript
command.executeLowerCase()
```

## Description

Select the text you want to convert and execute the corresponding command to convert the case.
