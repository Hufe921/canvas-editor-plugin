import Editor from '@hufe921/canvas-editor'
import importExcel from './importExcel'

export default function excelPlugin(editor: Editor) {
  const command = editor.command

  command.executeImportExcel = importExcel(command)
}
