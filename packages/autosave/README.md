<h1 align="center">canvas-editor-plugin-autosave</h1>

<p align="center">autosave plugin for canvas-editor</p>

## usage

```bash
npm i @hufe921/canvas-editor-plugin-autosave --save
```

```javascript
import Editor from '@hufe921/canvas-editor'
import autosavePlugin from '@hufe921/canvas-editor-plugin-autosave'

const instance = new Editor()
instance.use(autosavePlugin, {
  autoRestore?: boolean, // 注册插件时是否自动恢复已存在的存档，默认 true
  delay?: number, // 内容变化后防抖保存延迟（ms），0 表示关闭，默认 3000
  interval?: number, // 定时保存间隔（ms），0 表示关闭，默认 0
  storage?: Storage, // 存储实现，需兼容 Storage 接口，默认 localStorage
  key?: string, // 存储键，默认 'ce-autosave'
  maxCount?: number, // 最多保留的历史快照份数，超出淘汰最旧的，默认 10
  snapshotMinInterval?: number, // 历史快照最小间隔（ms），间隔内的连续保存合并为一份，默认 60000
  flushOnUnload?: boolean, // 页面关闭前是否保存未落盘的变更，默认 true
  onSave?: (snapshot: IAutosaveSnapshot) => void,
  onRestore?: (snapshot: IAutosaveSnapshot) => boolean | void, // 返回 false 可取消恢复
  onError?: (error: Error) => void
})

instance.command.executeAutosave() // 立即保存一份快照
instance.command.executeAutosaveRestore() // 恢复最近一份快照，返回是否恢复成功
instance.command.executeAutosaveRestore(2) // 恢复第 3 份快照（按时间倒序）
instance.command.executeGetAutosaveData() // 获取最近一份快照，无存档时返回 null
instance.command.executeGetAutosaveList() // 获取全部历史快照（按时间倒序）
instance.command.executeHasUnsavedChanges() // 是否有未保存的变更
instance.command.executeAutosaveClear() // 清空全部快照
```
