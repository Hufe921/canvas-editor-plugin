import { Editor } from '@hufe921/canvas-editor'
import { IAutosavePluginOption, IAutosaveSnapshot } from './interface'
import { DEFAULT_KEY } from './constant'

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeAutosave(): void
    executeAutosaveRestore(): boolean
    executeGetAutosaveData(): IAutosaveSnapshot | null
    executeAutosaveClear(): void
    executeHasUnsavedChanges(): boolean
  }
}

export default function autosavePlugin(
  editor: Editor,
  options?: IAutosavePluginOption
) {
  const command = editor.command
  const storage = options?.storage || window.localStorage
  const key = options?.key || DEFAULT_KEY
  const autoRestore = options?.autoRestore !== false
  const delay = options?.delay ?? 3000
  const interval = options?.interval || 0
  const flushOnUnload = options?.flushOnUnload !== false

  let debounceTimer: number | undefined
  let intervalTimer: number | undefined
  // 内容变化后置为脏标记，定时保存与卸载前保存只处理有变更的情况
  let isDirty = false

  const readSnapshot = (): IAutosaveSnapshot | null => {
    try {
      const value = storage.getItem(key)
      if (!value) return null
      return JSON.parse(value) as IAutosaveSnapshot
    } catch (error) {
      options?.onError?.(error as Error)
      return null
    }
  }

  const save = () => {
    // 已有防抖保存排队时取消，避免重复写入
    window.clearTimeout(debounceTimer)
    const { version, data } = command.getValue()
    const snapshot: IAutosaveSnapshot = {
      version,
      saveTime: Date.now(),
      data
    }
    try {
      storage.setItem(key, JSON.stringify(snapshot))
      isDirty = false
      options?.onSave?.(snapshot)
    } catch (error) {
      options?.onError?.(error as Error)
    }
  }

  const restore = (): boolean => {
    const snapshot = readSnapshot()
    if (!snapshot?.data) return false
    // onRestore 返回 false 时取消本次恢复
    if (options?.onRestore?.(snapshot) === false) return false
    command.executeSetValue(snapshot.data)
    return true
  }

  command.executeAutosave = () => {
    save()
  }

  command.executeAutosaveRestore = () => {
    return restore()
  }

  command.executeGetAutosaveData = () => {
    return readSnapshot()
  }

  command.executeAutosaveClear = () => {
    storage.removeItem(key)
  }

  command.executeHasUnsavedChanges = () => {
    return isDirty
  }

  // 注册时自动恢复存档
  if (autoRestore) {
    restore()
  }

  editor.eventBus.on('contentChange', () => {
    isDirty = true
    if (delay <= 0) return
    window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(save, delay)
  })

  if (interval > 0) {
    intervalTimer = window.setInterval(() => {
      if (isDirty) save()
    }, interval)
  }

  const onBeforeUnload = () => {
    if (isDirty) save()
  }
  if (flushOnUnload) {
    window.addEventListener('beforeunload', onBeforeUnload)
  }

  // 编辑器销毁时清理定时器与事件监听
  const originalDestroy = editor.destroy
  editor.destroy = () => {
    window.clearTimeout(debounceTimer)
    if (intervalTimer) window.clearInterval(intervalTimer)
    window.removeEventListener('beforeunload', onBeforeUnload)
    originalDestroy()
  }
}

export type { IAutosavePluginOption, IAutosaveSnapshot }
