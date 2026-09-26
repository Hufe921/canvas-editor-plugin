import Editor from '@hufe921/canvas-editor'
import exportOfd from './exportOfd'
import importOfd from './importOfd'

export default function ofdPlugin(editor: Editor) {
  // 导入文档
  editor.command.executeImportOfd = importOfd(editor.command)
  // 导出文档
  editor.command.executeExportOfd = exportOfd(editor)
}

export type { IExportOfdOption } from './exportOfd'
export type { IImportOfdOption } from './importOfd'
export { prefetchOfdFonts } from './embedFonts'
