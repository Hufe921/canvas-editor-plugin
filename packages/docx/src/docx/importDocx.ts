import { Command } from '@hufe921/canvas-editor'
import mammoth from 'mammoth'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeImportDocx(options: IImportDocxOption): void
  }
}

export interface IImportDocxOption {
  arrayBuffer: ArrayBuffer
}

const waitImgWH = (value: string): Promise<string> => new Promise((resolve) => {
  const dom = document.createElement('div')
  dom.innerHTML = value
  setTimeout(() => {
    resolve(dom.innerHTML)
  }, 0)
})

export default function (command: Command) {
  return async function (options: IImportDocxOption) {
    const { arrayBuffer } = options
    const result = await mammoth.convertToHtml({
      arrayBuffer
    })
    const value = result.value.includes('<img') ? await waitImgWH(result.value) : result.value
    command.executeSetHTML({
      main: value
    })
  }
}
