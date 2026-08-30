import Editor from '@hufe921/canvas-editor'

export interface IToolbarDivider {
  isDivider: true
  key?: string
}

export interface IToolbarAction {
  key: string
  title?: string
  icon?: string // CSS类名或自定义图标字符串
  isDivider?: false
  callback: (editor: Editor) => void
}

export type IToolbarItem = IToolbarDivider | IToolbarAction

export interface IToolbarRegister {
  key?: string
  isDivider?: boolean
  title?: string
  icon?: string
  render?: (container: HTMLDivElement, editor: Editor) => void
  callback?: (editor: Editor) => void
}

export interface IFloatingToolbarOptions {
  customItems?: IToolbarItem[]
  showDefaultItems?: boolean
}
