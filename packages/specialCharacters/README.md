<h1 align="center">canvas-editor-plugin-special-characters</h1>

<p align="center">special characters plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-special-characters --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import specialCharactersPlugin from '@hufe921/canvas-editor-plugin-special-characters'

const instance = new Editor()
instance.use(specialCharactersPlugin)

// 打开字符选择弹窗
instance.command.executeOpenSpecialCharactersDialog()

// 使用自定义配置
instance.use(specialCharactersPlugin, {
  characters: [
    {
      name: '自定义分组',
      characters: [
        { char: '★', name: '五角星' },
        { char: '☆', name: '空心五角星' }
      ]
    }
  ],
  onSelect: (char) => {
    console.log('Selected:', char)
  }
})
```
