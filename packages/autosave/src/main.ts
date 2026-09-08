import Editor from '@hufe921/canvas-editor'
import autosavePlugin from './autosave'
import type { IAutosaveSnapshot } from './autosave'

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(container, {
    main: [
      { value: '自动保存示例：编辑内容后 3 秒自动保存，刷新页面自动还原\n' }
    ]
  })
  instance.use(autosavePlugin, {
    onSave: (snapshot: IAutosaveSnapshot) => {
      console.log('已保存', new Date(snapshot.saveTime).toLocaleTimeString())
    },
    onRestore: snapshot => {
      console.log('恢复存档', new Date(snapshot.saveTime).toLocaleTimeString())
    }
  })

  const saveBtn = document.querySelector('#save') as HTMLButtonElement
  saveBtn.onclick = () => {
    instance.command.executeAutosave()
  }

  const restoreBtn = document.querySelector('#restore') as HTMLButtonElement
  restoreBtn.onclick = () => {
    const isRestored = instance.command.executeAutosaveRestore()
    if (!isRestored) {
      alert('暂无可恢复的存档')
    }
  }

  const infoBtn = document.querySelector('#info') as HTMLButtonElement
  infoBtn.onclick = () => {
    const snapshot = instance.command.executeGetAutosaveData()
    alert(
      snapshot
        ? JSON.stringify({ ...snapshot, data: undefined }, null, 2)
        : '暂无存档'
    )
  }

  const clearBtn = document.querySelector('#clear') as HTMLButtonElement
  clearBtn.onclick = () => {
    instance.command.executeAutosaveClear()
  }
}
