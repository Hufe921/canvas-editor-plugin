import { Command, Editor, ElementType } from '@hufe921/canvas-editor'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeUpperCase(): void
    executeLowerCase(): void
  }
}

const TEXTLIKE_ELEMENT_TYPE: ElementType[] = [
  ElementType.TEXT,
  ElementType.SUBSCRIPT,
  ElementType.SUPERSCRIPT
]

enum CaseType {
  UPPER = 'upper',
  LOWER = 'lower'
}

function toCase(command: Command, type: CaseType) {
  const rangeContext = command.getRangeContext()
  if (!rangeContext?.selectionElementList?.length) return
  const selectionElementList = rangeContext.selectionElementList
  const isExistNonTextElement = selectionElementList.some(
    element => element.type && !TEXTLIKE_ELEMENT_TYPE.includes(element.type)
  )
  if (isExistNonTextElement) return
  // 缓存旧光标数据
  const oldRange = command.getRange()
  // 修改选中元素大小写
  selectionElementList.forEach(element => {
    element.value =
      type === CaseType.UPPER
        ? element.value.toUpperCase()
        : element.value.toLowerCase()
  })
  // 插入后进行光标选择
  command.executeInsertElementList(selectionElementList)
  command.executeReplaceRange(oldRange)
}

export default function casePlugin(editor: Editor) {
  const command = editor.command

  command.executeUpperCase = () => {
    toCase(command, CaseType.UPPER)
  }

  command.executeLowerCase = () => {
    toCase(command, CaseType.LOWER)
  }
}
