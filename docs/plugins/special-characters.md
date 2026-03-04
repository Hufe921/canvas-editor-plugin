# 特殊字符

特殊字符选择对话框插件。

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-special-characters
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import specialCharactersPlugin from '@hufe921/canvas-editor-plugin-special-characters'

const instance = new Editor()
instance.use(specialCharactersPlugin)

command.executeOpenSpecialCharactersDialog({
  characters?: ICharacterCategory[],
  onSelect?: (char: string) => void
})
```

## 参数

| 参数 | 类型 | 说明 |
|------|------|------|
| characters | ICharacterCategory[] | 可选，自定义字符分类 |
| onSelect | function | 可选，选中字符时的回调 |

## 类型定义

```typescript
interface ICharacterCategory {
  name: string
  characters: string[]
}
```

## 示例

```javascript
command.executeOpenSpecialCharactersDialog({
  characters: [
    {
      name: '数学符号',
      characters: ['±', '×', '÷', '∞', '∑', '∏']
    },
    {
      name: '货币符号',
      characters: ['$', '€', '£', '¥', '₩', '₽']
    }
  ],
  onSelect: (char) => {
    console.log('选中了字符:', char)
  }
})
```
