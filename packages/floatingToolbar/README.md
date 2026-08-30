<h1 align="center">canvas-editor-plugin-floating-toolbar</h1>

<p align="center">floating toolbar plugin for canvas-editor</p>

## 基本用法

```bash
npm i @hufe921/canvas-editor-plugin-floating-toolbar --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import floatingToolbarPlugin from '@hufe921/canvas-editor-plugin-floating-toolbar'

const instance = new Editor()
instance.use(floatingToolbarPlugin)
```

## 高级用法

### 自定义工具栏

```javascript
import Editor from '@hufe921/canvas-editor'
import floatingToolbarPlugin from '@hufe921/canvas-editor-plugin-floating-toolbar'

const instance = new Editor()

// 配置选项
const options = {
  // 是否显示默认工具栏项，默认为true
  showDefaultItems: true,

  // 自定义工具栏项
  customItems: [
    {
      key: 'custom-ai-polish',
      title: 'AI润色',
      icon: '.icon-ai-polish', // CSS类图标（以.开头表示使用CSS类）
      callback: editor => {
        alert('AI润色功能尚未实现')
      }
    },
    // 添加分隔符
    {
      isDivider: true,
      key: 'divider-1' // key对分隔符是可选的
    },
    {
      key: 'custom-text-icon',
      title: '文本图标',
      icon: 'T', // 文本图标（直接使用字符作为图标）
      callback: editor => {
        // 自定义功能
      }
    }
  ]
}

instance.use(floatingToolbarPlugin, options)
```

### 图标类型

浮动工具栏支持两种类型的图标:

1. **CSS 类图标**

   - 使用`.className`格式，如：`.icon-align-left`
   - 插件会自动将其解析为 CSS 类名并应用到图标元素上
   - 您需要在 CSS 中定义相应的样式，例如：

   ```css
   /* 方法1: 使用SVG文件 */
   .icon-ai-polish {
     background-image: url('/path/to/icons/ai-polish.svg');
     background-position: center;
     background-repeat: no-repeat;
     background-size: contain;
   }
   ```

2. **文本图标**
   - 直接使用文本字符作为图标，如：`T`、`B`、`I`等
   - 适合简单的图标表示，会居中显示在工具栏按钮中

### 分隔符

您可以在工具栏中添加分隔符来分隔不同功能的按钮：

```javascript
{
  isDivider: true,
  key: 'divider-name'  // 可选，用于标识分隔符
}
```

分隔符会在工具栏中显示为垂直线。

## 接口说明

### 选项接口

```typescript
// 工具栏配置选项
interface IFloatingToolbarOptions {
  customItems?: IToolbarItem[] // 自定义工具栏项
  showDefaultItems?: boolean // 是否显示默认工具栏项
}

// 分隔符项
interface IToolbarDivider {
  isDivider: true
  key?: string // 可选的标识符
}

// 常规工具栏项
interface IToolbarAction {
  key: string // 唯一标识
  title?: string // 悬停提示
  icon?: string // 图标（CSS类名或自定义文本）
  callback: (editor: Editor) => void // 点击回调
}

// 工具栏项可以是常规项或分隔符
type IToolbarItem = IToolbarDivider | IToolbarAction
```
