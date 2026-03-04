# 大小写转换

文本大小写转换插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-case
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import casePlugin from '@hufe921/canvas-editor-plugin-case'

const instance = new Editor()
instance.use(casePlugin)
```

## 命令

### 转为大写

```javascript
command.executeUpperCase()
```

### 转为小写

```javascript
command.executeLowerCase()
```

## 说明

选中需要转换的文本后执行相应命令即可转换大小写。
