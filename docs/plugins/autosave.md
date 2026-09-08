# 自动保存

自动保存插件，将文档数据快照到浏览器存储（默认 localStorage），刷新或意外关闭页面后自动还原，避免内容丢失。

定位是**保底恢复**：存储里只保留一份最新快照。会话内的误删回退请使用编辑器撤销能力；跨会话的多版本快照建议由应用结合服务端或 IndexedDB 自行实现。

注册插件时会自动恢复存档（可用 `autoRestore: false` 关闭）。

保存时机有以下几种，可按需组合：

- **内容变化后防抖保存**：停止编辑 `delay` 毫秒后保存（默认开启，3000ms）
- **定时保存**：每隔 `interval` 毫秒保存一次，仅保存有变更的周期（默认关闭）
- **页面关闭前保存**：`beforeunload` 时落盘未保存的变更（默认开启）
- **手动保存**：调用 `command.executeAutosave()`

## 安装

```bash
npm install @hufe921/canvas-editor-plugin-autosave
```

## 使用

```javascript
import Editor from '@hufe921/canvas-editor'
import autosavePlugin from '@hufe921/canvas-editor-plugin-autosave'

const instance = new Editor()
instance.use(autosavePlugin)

command.executeAutosave() // 立即保存
command.executeAutosaveRestore() // 恢复存档，返回是否恢复成功
command.executeGetAutosaveData() // 获取存档数据，无存档时返回 null
command.executeHasUnsavedChanges() // 是否有未保存的变更
command.executeAutosaveClear() // 清空存档
```

## 参数

注册插件时传入默认配置：

| 参数         | 类型     | 说明                                                    |
| ------------ | -------- | ------------------------------------------------------- |
| autoRestore  | boolean  | 可选，注册插件时是否自动恢复已存在的存档，默认 true     |
| delay        | number   | 可选，内容变化后防抖保存延迟（ms），0 关闭，默认 3000   |
| interval     | number   | 可选，定时保存间隔（ms），0 关闭，默认 0                |
| storage      | Storage  | 可选，存储实现，需兼容 Storage 接口，默认 localStorage  |
| key          | string   | 可选，存储键，默认 'ce-autosave'                        |
| flushOnUnload | boolean | 可选，页面关闭前是否保存未落盘的变更，默认 true         |
| onSave       | function | 可选，每次保存成功后的回调                              |
| onRestore    | function | 可选，恢复存档前的回调（含注册时自动恢复），返回 false 可取消本次恢复 |
| onError      | function | 可选，保存失败（如存储空间不足）时的回调                |

```javascript
instance.use(autosavePlugin, {
  delay: 5000,
  interval: 60000,
  storage: sessionStorage, // 改用会话存储
  key: 'my-doc-autosave',
  onSave: snapshot => {
    console.log('已保存', new Date(snapshot.saveTime))
  }
})
```

## 类型定义

```typescript
interface IAutosaveSnapshot {
  // 编辑器版本号（来自 command.getValue）
  version: string
  // 保存时间戳（毫秒）
  saveTime: number
  // 文档数据（header / main / footer / graffiti）
  data: IEditorData
}

interface IAutosavePluginOption {
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
```

## 示例

关闭自动恢复，由应用自己决定恢复时机（如进入页面时询问用户）：

```javascript
instance.use(autosavePlugin, {
  autoRestore: false
})

const snapshot = instance.command.executeGetAutosaveData()

if (snapshot && confirm(`检测到 ${new Date(snapshot.saveTime)} 的存档，是否恢复？`)) {
  instance.command.executeAutosaveRestore()
}
```

结合 `executeHasUnsavedChanges` 做离开提醒：

```javascript
window.addEventListener('beforeunload', evt => {
  if (instance.command.executeHasUnsavedChanges()) {
    evt.preventDefault()
  }
})
```
