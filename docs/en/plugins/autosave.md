# Autosave

Autosave plugin. Snapshots the document data into browser storage (localStorage by default) and restores it automatically after a refresh or accidental page close.

It is designed as a **last-resort recovery**: storage keeps only the latest snapshot. For undoing mistakes within a session, use the editor's undo capability; for cross-session multi-version snapshots, implement it in the app with a server or IndexedDB instead.

An existing snapshot is restored automatically when the plugin registers (disable with `autoRestore: false`).

Saves are triggered in the following ways, which can be combined as needed:

- **Debounced save after content change**: saves `delay` milliseconds after editing stops (enabled by default, 3000ms)
- **Interval save**: saves every `interval` milliseconds, skipping cycles without changes (disabled by default)
- **Flush on page close**: saves unsaved changes on `beforeunload` (enabled by default)
- **Manual save**: call `command.executeAutosave()`

## Installation

```bash
npm install @hufe921/canvas-editor-plugin-autosave
```

## Usage

```javascript
import Editor from '@hufe921/canvas-editor'
import autosavePlugin from '@hufe921/canvas-editor-plugin-autosave'

const instance = new Editor()
instance.use(autosavePlugin)

command.executeAutosave() // save immediately
command.executeAutosaveRestore() // restore the snapshot, returns whether it succeeded
command.executeGetAutosaveData() // get the snapshot data, returns null when absent
command.executeHasUnsavedChanges() // whether there are unsaved changes
command.executeAutosaveClear() // clear the snapshot
```

## Parameters

Default options can be provided when registering the plugin:

| Parameter     | Type     | Description                                                                        |
| ------------- | -------- | ---------------------------------------------------------------------------------- |
| autoRestore   | boolean  | Optional, whether to restore an existing snapshot automatically on registration, default true |
| delay         | number   | Optional, debounced save delay after content change (ms), 0 disables, default 3000 |
| interval      | number   | Optional, interval save period (ms), 0 disables, default 0                         |
| storage       | Storage  | Optional, storage implementation compatible with the Storage interface, defaults to localStorage |
| key           | string   | Optional, storage key, default 'ce-autosave'                                       |
| flushOnUnload | boolean  | Optional, whether to save unsaved changes before the page closes, default true     |
| onSave        | function | Optional, callback after each successful save                                      |
| onRestore     | function | Optional, callback before restoring a snapshot (including automatic restore on registration), return false to cancel the restore |
| onError       | function | Optional, callback when a save fails (e.g. storage quota exceeded)                 |

```javascript
instance.use(autosavePlugin, {
  delay: 5000,
  interval: 60000,
  storage: sessionStorage, // use session storage instead
  key: 'my-doc-autosave',
  onSave: snapshot => {
    console.log('saved at', new Date(snapshot.saveTime))
  }
})
```

## Type Definition

```typescript
interface IAutosaveSnapshot {
  // Editor version (from command.getValue)
  version: string
  // Save timestamp (ms)
  saveTime: number
  // Document data (header / main / footer / graffiti)
  data: IEditorData
}

interface IAutosavePluginOption {
  // Whether to restore an existing snapshot automatically on registration, default true
  autoRestore?: boolean
  // Debounced save delay after content change (ms), 0 disables, default 3000
  delay?: number
  // Interval save period (ms), 0 disables, default 0
  interval?: number
  // Storage implementation compatible with the Storage interface, defaults to localStorage
  storage?: Storage
  // Storage key, default 'ce-autosave'
  key?: string
  // Whether to save unsaved changes before the page closes, default true
  flushOnUnload?: boolean
  // Callback after each successful save
  onSave?: (snapshot: IAutosaveSnapshot) => void
  // Callback before restoring a snapshot (including automatic restore on registration), return false to cancel the restore
  onRestore?: (snapshot: IAutosaveSnapshot) => boolean | void
  // Callback when a save fails (e.g. storage quota exceeded)
  onError?: (error: Error) => void
}
```

## Example

Disable automatic restore and let the app decide when to restore (e.g. ask the user on page load):

```javascript
instance.use(autosavePlugin, {
  autoRestore: false
})

const snapshot = instance.command.executeGetAutosaveData()

if (snapshot && confirm(`Found a snapshot from ${new Date(snapshot.saveTime)}, restore it?`)) {
  instance.command.executeAutosaveRestore()
}
```

Use `executeHasUnsavedChanges` to warn before leaving:

```javascript
window.addEventListener('beforeunload', evt => {
  if (instance.command.executeHasUnsavedChanges()) {
    evt.preventDefault()
  }
})
```
