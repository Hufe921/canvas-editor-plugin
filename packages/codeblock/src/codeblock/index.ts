import { Editor, IElement } from '@hufe921/canvas-editor'
import prism from 'prismjs'
import { formatPrismToken } from './prism'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeInsertCodeblock(content: string): void
  }
}

export default function barcodePlugin(editor: Editor) {
  const command = editor.command
  // 代码块
  command.executeInsertCodeblock = (content: string) => {
    if (!content) return
    const tokenList = prism.tokenize(content, prism.languages.javascript)
    const formatTokenList = formatPrismToken(tokenList)
    const elementList: IElement[] = []
    for (let i = 0; i < formatTokenList.length; i++) {
      const formatToken = formatTokenList[i]
      const tokenStringList = formatToken.content.split('')
      for (let j = 0; j < tokenStringList.length; j++) {
        const value = tokenStringList[j]
        const element: IElement = {
          value
        }
        if (formatToken.color) {
          element.color = formatToken.color
        }
        if (formatToken.bold) {
          element.bold = true
        }
        if (formatToken.italic) {
          element.italic = true
        }
        elementList.push(element)
      }
    }
    elementList.unshift({
      value: '\n'
    })
    command.executeInsertElementList(elementList)
  }
}
