# 输入联想

输入联想/短语自动提醒插件。输入时自动提取光标前的查询词，实时匹配候选短语并以下拉面板提醒，选中后用完整短语替换已输入的查询词。支持键盘上下导航、回车/Tab 选中、Escape 关闭，也可通过命令程序化打开。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-suggestion
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
command.executeSuggestion()
```

## 参数

| 参数     | 类型                                        | 说明                                                      |
| -------- | ------------------------------------------- | --------------------------------------------------------- |
| dataList | ISuggestionItem[] \| () => ISuggestionItem[] | 必填，候选数据（数组或返回数组的函数）                    |
| minLength | number                                     | 可选，触发联想的最小查询词长度，默认 1                    |
| max      | number                                      | 可选，候选最多显示条数，默认 5                            |
| match    | 'prefix' \| 'contains' \| function          | 可选，匹配方式，默认 prefix，内置方式均大小写不敏感       |
| onSelect | function                                    | 可选，选中候选项回调                                      |
| locale   | string                                      | 可选，面板语言（内置 zhCN、en），默认取编辑器 locale 配置 |
| lang     | Partial\<ISuggestionLang\>                  | 可选，覆盖对应语言的面板文案                              |

## 类型定义

```typescript
interface ISuggestionItem {
  id: string
  name: string
  // 选中后实际插入的短语，缺省时插入 name
  value?: string
  [key: string]: any
}

// 匹配方式：前缀匹配、包含匹配或自定义匹配函数（内置方式均大小写不敏感）
type ISuggestionMatch =
  | 'prefix'
  | 'contains'
  | ((query: string, item: ISuggestionItem) => boolean)

interface ISuggestionLang {
  // 无匹配候选时的空态文案
  emptyText: string
}
```

## 示例

```javascript
instance.use(suggestionPlugin, {
  dataList: () => fetchPhraseList(),
  max: 8,
  match: 'contains',
  onSelect: item => {
    console.log('选中', item)
  }
})
```
