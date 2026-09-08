import type { IEditorData } from '@hufe921/canvas-editor'

export interface IAutosaveSnapshot {
  // 编辑器版本号（来自 command.getValue）
  version: string
  // 保存时间戳（毫秒）
  saveTime: number
  // 文档数据（header / main / footer / graffiti）
  data: IEditorData
}

export interface IAutosavePluginOption {
  // 注册插件时是否自动恢复已存在的存档，默认 true
  autoRestore?: boolean
  // 内容变化后防抖保存延迟（ms），0 表示关闭，默认 3000
  delay?: number
  // 定时保存间隔（ms），0 表示关闭，默认 0
  interval?: number
  // 存储实现，需兼容 Storage 接口，默认 localStorage
  storage?: Storage
  // 存储键，默认 'ce-autosave'
  key?: string
  // 页面关闭前是否保存未落盘的变更，默认 true
  flushOnUnload?: boolean
  // 每次保存成功后的回调
  onSave?: (snapshot: IAutosaveSnapshot) => void
  // 恢复存档前的回调（含注册时自动恢复），返回 false 可取消本次恢复
  onRestore?: (snapshot: IAutosaveSnapshot) => boolean | void
  // 保存失败（如存储空间不足）时的回调
  onError?: (error: Error) => void
}
