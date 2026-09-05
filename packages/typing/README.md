# canvas-editor-plugin-typing

打字挑战游戏插件 for canvas-editor。

在文档末尾插入打字挑战闯关：范文 / 判定行 / 实时统计条 / 输入行。光标自动落在输入行，照着范文输入，判定行逐字符变绿（正确）/ 变红（错误），用时、速度、正确率实时刷新，输完自动判定完成并回调成绩。闯关题目完全由外部传入，支持多关闯关（打完一关自动追加下一关）与单关练习，全部结束后追加总成绩行（总用时、平均速度、平均正确率）。整个游戏纯富文本能力驱动（逐键内容事件 + 字符级着色 + 文本控件），无 iframe，内置中英文界面文案并支持自定义。

## Usage

```ts
import Editor from '@hufe921/canvas-editor'
import typingPlugin from '@hufe921/canvas-editor-plugin-typing'

const editor = new Editor(container, { main: [] })
editor.use(typingPlugin, {
  passages: ['千里之行，始于足下。', 'Actions speak louder than words.'], // 闯关题目（每项一关），由外部传入
  locale: 'zhCN', // 界面语言（内置 zhCN、en），lang 可逐项覆盖文案
  onFinished: result => {
    // { duration, speed, accuracy, total, correct, level, levelCount }
    console.log(result)
  }
})

// 使用插件配置的题目闯关
editor.command.executeTyping()
// 单次调用传入题目
editor.command.executeTyping({
  passages: ['纸上得来终觉浅，绝知此事要躬行。']
})
// 单关练习
editor.command.executeTyping({ text: '千里之行，始于足下。' })
```
