<h1 align="center">canvas-editor-plugin-suggestion</h1>

<p align="center">suggestion plugin for canvas-editor</p>

## 简介

canvas-editor 输入联想/短语自动提醒插件。输入时自动提取光标前的查询词，
实时匹配候选短语并以下拉面板提醒，选中后用完整短语替换已输入的查询词。
支持键盘上下导航、回车/Tab 选中、Escape 关闭，也可通过命令程序化打开。

## 安装

```bash
npm i @hufe921/canvas-editor-plugin-suggestion --save
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import suggestionPlugin from '@hufe921/canvas-editor-plugin-suggestion'

const instance = new Editor()
instance.use(suggestionPlugin, {
  dataList: [
    { id: '1', name: '患者男性，否认药物过敏史' },
    { id: '2', name: '心肺听诊未闻及明显异常' }
  ],
  onSelect: item => {
    console.log(item)
  }
})

// 程序化打开候选面板（不跟踪查询词，选中后直接插入）
instance.command.executeSuggestion(options?)
```

## 配置项

| 属性 | 类型 | 必填 | 默认值 | 说明 |
| ---- | ---- | ---- | ------ | ---- |
| dataList | `ISuggestionItem[] \| (() => ISuggestionItem[])` | 是 | - | 候选数据（数组或返回数组的函数） |
| minLength | `number` | 否 | `1` | 触发联想的最小查询词长度 |
| max | `number` | 否 | `5` | 候选最多显示条数 |
| match | `'prefix' \| 'contains' \| ((query, item) => boolean)` | 否 | `'prefix'` | 匹配方式，内置方式均大小写不敏感 |
| onSelect | `(item: ISuggestionItem) => void` | 否 | - | 选中候选项回调 |
| locale | `string` | 否 | 取编辑器 locale，回退 `zhCN` | 面板语言（内置 zhCN、en） |
| lang | `Partial<ISuggestionLang>` | 否 | - | 覆盖对应语言的面板文案 |

```typescript
interface ISuggestionItem {
  id: string
  name: string
  // 选中后实际插入的短语，缺省时插入 name
  value?: string
  [key: string]: any
}

interface ISuggestionLang {
  // 无匹配候选时的空态文案
  emptyText: string
}
```
