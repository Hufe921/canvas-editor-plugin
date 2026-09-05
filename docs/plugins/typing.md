# 打字挑战

在文档里进行打字挑战 ⌨️。插件在文档末尾追加「范文 + 判定行 + 实时统计 + 输入行」，光标自动落在输入行，照着范文输入即可：判定行逐字符变绿 / 变红，用时、速度、正确率实时写入统计条，输完自动判定完成并回调成绩。闯关题目完全由外部传入，支持多关闯关（打完一关自动追加下一关）与单关练习，全部结束后追加总成绩行（总用时、平均速度、平均正确率）；整个游戏完全由编辑器的富文本能力驱动（逐键内容事件 + 字符级着色 + 文本控件），无 iframe，内置中英文界面文案并支持自定义。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-typing
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import typingPlugin from '@hufe921/canvas-editor-plugin-typing'

const instance = new Editor()
instance.use(typingPlugin, options?: ITypingOption)

instance.command.executeTyping(options?: ITypingGameOption)
```

## 插件选项

```typescript
interface ITypingOption {
  passages?: string[] // 闯关题目（每项一关），由外部传入，必配
  locale?: string // 界面语言（内置 zhCN、en），默认取编辑器 locale 配置
  lang?: Partial<ITypingLang> // 覆盖对应语言的界面文案
  onFinished?: (result: ITypingResult) => void // 每关完成时回调，返回当局成绩与关卡信息
}

interface ITypingResult {
  duration: number // 用时（秒）
  speed: number // 速度（字/分）
  accuracy: number // 正确率（0-100）
  total: number // 本关范文总字数
  correct: number // 正确字数
  level: number // 当前关（1 开始）
  levelCount: number // 总关数
}
```

## 命令参数

```typescript
interface ITypingGameOption {
  passages?: string[] // 单次调用的闯关题目，优先级高于插件默认题目
  text?: string // 自定义单关范文，优先级低于 passages
  locale?: string
  lang?: Partial<ITypingLang>
}
```

## 示例

```javascript
// 使用插件配置的题目闯关
instance.command.executeTyping()

// 单次调用传入题目
instance.command.executeTyping({
  passages: ['纸上得来终觉浅，绝知此事要躬行。']
})

// 英文界面 + 英文题目
instance.command.executeTyping({
  locale: 'en',
  passages: ['Actions speak louder than words.']
})
```

每关的文档结构为「标题 / 范文 / 判定行 / 统计条 / 输入行」：范文用 disabled 文本控件承载，光标误入也无法改写游戏数据；判定行初始为浅灰范文镜像，输入正确的字符变绿、错误变红（并显示实际输入的字符），退格回退；统计条实时刷新用时、速度与正确率，完成本关后显示 🎉 并通过 `onFinished` 回调返回成绩，随后自动在文档末尾追加下一关，光标自动接力到新输入行；最后一关结束后追加加粗的「🏆 总成绩」行，汇总总用时、平均速度与平均正确率。
