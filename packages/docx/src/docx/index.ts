import Editor from '@hufe921/canvas-editor'
import exportDocx from './exportDocx'
import importDocx from './importDocx'

export default function docxPlugin(editor: Editor) {
  // 导入文档
  editor.command.executeImportDocx = importDocx(editor.command)
  // 导出文档
  editor.command.executeExportDocx = exportDocx(editor)
}

export type { IExportDocxOption } from './exportDocx'
export type { IImportDocxOption } from './importDocx'
