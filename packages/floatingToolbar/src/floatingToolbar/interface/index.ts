import Editor from '@hufe921/canvas-editor'

export interface IToolbarRegister {
  key: string
  callback: (editor: Editor) => void
}
