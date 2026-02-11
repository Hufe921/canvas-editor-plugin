# @hufe921/canvas-editor-plugin-menstrual-history

canvas-editor 月经史医学公式插件

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-menstrual-history
```

## 使用

```typescript
import Editor from '@hufe921/canvas-editor'
import menstrualHistoryPlugin from '@hufe921/canvas-editor-plugin-menstrual-history'

const instance = new Editor(container, {
  main: []
})

instance.use(menstrualHistoryPlugin)

// 固定的显示高度
const DISPLAY_HEIGHT = 30

// 注册右键菜单
instance.register.contextMenuList([
  {
    name: '插入月经史',
    when: payload => {
      return !payload.isReadonly && payload.editorTextFocus
    },
    callback: command => {
      command.executeLoadMenstrualHistory({
        onConfirm: result => {
          const { svg, width, height, ...data } = result
          // 根据固定高度等比例计算宽度
          const displayWidth = Math.round((width / height) * DISPLAY_HEIGHT)
          command.executeInsertElementList([
            {
              type: ElementType.IMAGE,
              width: displayWidth,
              height: DISPLAY_HEIGHT,
              value: svg,
              extension: {
                name: 'menstrualHistory',
                data
              }
            }
          ])
        }
      })
    }
  },
  {
    name: '编辑月经史',
    when: payload => {
      const extension = payload.startElement?.extension as any
      return (
        !payload.isReadonly &&
        payload.editorTextFocus &&
        extension?.name === 'menstrualHistory'
      )
    },
    callback: (command, context) => {
      const extension = context.startElement?.extension as any
      const data = extension?.data

      command.executeLoadMenstrualHistory({
        data,
        onConfirm: result => {
          const { svg, width, height, ...newData } = result
          // 根据固定高度等比例计算宽度
          const displayWidth = Math.round((width / height) * DISPLAY_HEIGHT)
          command.executeUpdateElementById({
            id: context.startElement!.id!,
            properties: {
              width: displayWidth,
              height: DISPLAY_HEIGHT,
              value: svg,
              extension: {
                name: 'menstrualHistory',
                data: newData
              }
            }
          })
        }
      })
    }
  }
])
```

## 数据结构

```typescript
interface IMenstrualHistoryData {
  /** 初潮年龄 */
  menarcheAge: string
  /** 行经期天数 */
  menstrualDuration: string
  /** 月经周期天数 */
  menstrualCycle: string
  /** 末次月经时间 */
  lastMenstrualPeriod: string
}

interface IMenstrualHistoryOption {
  /** 初始数据（用于二次编辑） */
  data?: IMenstrualHistoryData
  /** 弹窗关闭回调，返回SVG和实际宽高 */
  onConfirm?: (
    data: IMenstrualHistoryData & {
      svg: string
      width: number
      height: number
    }
  ) => void
  /** 弹窗取消回调 */
  onCancel?: () => void
}
```

## 公式格式

月经史公式格式：

```
        经期天数
初潮年龄 ─────── 末次月经日期
        周期天数
```

示例：

```
      4-5
14 ─────── 2024.03.15
     28-30
```
