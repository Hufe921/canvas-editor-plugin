# 拼写检查

拼写检查插件，基于 cspell 英文词典对文档中的英文单词进行校验，错词以下划线标出，点击错词可查看建议词并一键替换或忽略。

> 依赖 `@hufe921/canvas-editor` >= 1.0.2

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-spellcheck
```

## 使用

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
  ignoreWords: ['canvas-editor']
})
```

## 配置项

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| disabled | 是否禁用拼写检查 | boolean | false |
| suggestionCount | 建议词候选个数 | number | 3 |
| suggestionTimeout | 建议词生成超时时间（毫秒） | number | 100 |
| ignoreWords | 忽略词列表（不区分大小写） | string[] | [] |
| minWordLength | 参与检查的最小单词长度 | number | 1 |
| locale | 弹窗语言（内置 zhCN、en），默认取编辑器 locale 配置 | string | - |
| lang | 覆盖对应语言的弹窗文案 | Partial&lt;ISpellcheckLang&gt; | - |

## 国际化

插件内置 `zhCN`、`en` 两种弹窗语言，默认跟随编辑器的 `locale` 配置，也可通过 `locale` 单独指定，或使用 `lang` 覆盖任意文案：

```typescript
interface ISpellcheckLang {
  ignoreText: string // 弹窗忽略按钮文案
  emptyText: string // 弹窗无建议文案
}
```

```javascript
instance.use(spellcheckPlugin, {
  locale: 'en',
  lang: {
    emptyText: 'No suggestions'
  }
})
```

## 命令

```javascript
// 忽略指定单词（不区分大小写），并立即刷新错词标记
instance.command.executeSpellcheckIgnoreWord('word')
```
