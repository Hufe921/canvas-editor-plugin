# 代码块

代码块高亮显示插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-codeblock
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import codeblockPlugin from '@hufe921/canvas-editor-plugin-codeblock'

const instance = new Editor()
instance.use(codeblockPlugin)

instance.executeInsertCodeblock(content: string)
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 代码内容 |

## 示例

```javascript
instance.executeInsertCodeblock(`function hello() {
  console.log('Hello World');
}`)
```
