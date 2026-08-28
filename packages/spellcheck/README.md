<h1 align="center">canvas-editor-plugin-spellcheck</h1>

<p align="center">spellcheck plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-spellcheck --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import spellcheckPlugin from '@hufe921/canvas-editor-plugin-spellcheck'

const instance = new Editor(
  container,
  {
    main: [
      {
        value: 'Hello world'
      }
    ]
  },
  {
    spellcheck: {
      color: '#f54a45' // 错词下划线颜色
    }
  }
)
instance.use(spellcheckPlugin, {
  suggestionCount: 5,
  ignoreWords: ['canvas-editor'],
  lang: {
    emptyText: '没有建议'
  }
})
```

## options

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| disabled | 是否禁用拼写检查 | boolean | false |
| suggestionCount | 建议词候选个数 | number | 3 |
| suggestionTimeout | 建议词生成超时时间（毫秒） | number | 100 |
| ignoreWords | 忽略词列表（不区分大小写） | string[] | [] |
| minWordLength | 参与检查的最小单词长度 | number | 1 |
| locale | 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置 | string | - |
| lang | 覆盖对应语言的弹窗文案 | Partial&lt;ISpellcheckLang&gt; | - |

## i18n

```typescript
interface ISpellcheckLang {
  ignoreText: string // 弹窗忽略按钮文案
  emptyText: string // 弹窗无建议文案
}
```

## command

```javascript
// 忽略指定单词（不区分大小写），并立即刷新错词标记
instance.command.executeSpellcheckIgnoreWord('word')
```
