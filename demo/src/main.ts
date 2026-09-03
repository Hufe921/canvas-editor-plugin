import './index.scss'
import Editor, { ElementType } from '@hufe921/canvas-editor'
import barcode1dPlugin from '@hufe921/canvas-editor-plugin-barcode1d'
import barcode2dPlugin from '@hufe921/canvas-editor-plugin-barcode2d'
import casePlugin from '@hufe921/canvas-editor-plugin-case'
import codeblockPlugin from '@hufe921/canvas-editor-plugin-codeblock'
import commentPlugin from '@hufe921/canvas-editor-plugin-comment'
import diagramPlugin from '@hufe921/canvas-editor-plugin-diagram'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'
import excelPlugin from '@hufe921/canvas-editor-plugin-excel'
import findReplacePlugin from '@hufe921/canvas-editor-plugin-find-replace'
import floatingToolbarPlugin from '@hufe921/canvas-editor-plugin-floating-toolbar'
import markdownPlugin from '@hufe921/canvas-editor-plugin-markdown'
import menstrualHistoryPlugin from '@hufe921/canvas-editor-plugin-menstrual-history'
import mentionPlugin from '@hufe921/canvas-editor-plugin-mention'
import signaturePlugin from '@hufe921/canvas-editor-plugin-signature'
import specialCharactersPlugin from '@hufe921/canvas-editor-plugin-special-characters'
import spellcheckPlugin from '@hufe921/canvas-editor-plugin-spellcheck'
import suggestionPlugin from '@hufe921/canvas-editor-plugin-suggestion'
// 以下包的命令类型增强声明未从入口 re-export，需显式引入对应声明文件
import type {} from '@hufe921/canvas-editor-plugin-docx/dist/src/docx/importDocx'
import type {} from '@hufe921/canvas-editor-plugin-docx/dist/src/docx/exportDocx'
import type {} from '@hufe921/canvas-editor-plugin-excel/dist/src/excel/importExcel'
import type {} from '@hufe921/canvas-editor-plugin-markdown/dist/src/markdown/exportMarkdown'

const container = document.querySelector<HTMLDivElement>('#editor')!
const instance = new Editor(
  container,
  {
    main: [
      {
        value:
          'canvas-editor 插件演示文档。\n' +
          '本文档预置了 canvas-editor-plugin 的全部插件，可通过左侧操作面板体验各插件功能。\n' +
          '选中一段文本后会弹出浮动工具栏，也可以右键添加批注，批注卡片显示在页面右侧。\n' +
          '输入 @ 可以唤起提及候选浮层，例如 @张三，点击已插入的提及标签会触发回调。\n' +
          '按下 Ctrl/Cmd + F 或点击左侧的“查找替换”按钮，可以查找并替换文档内容。\n' +
          'This is a demostration of the speling check plugin, click a misspelledd word to see sugestions.'
      }
    ]
  },
  {
    spellcheck: {
      disabled: false,
      color: '#f54a45'
    }
  }
)
const command = instance.command

// 注册全部插件
instance.use(barcode1dPlugin)
instance.use(barcode2dPlugin)
instance.use(casePlugin)
instance.use(codeblockPlugin)
instance.use(commentPlugin, {
  user: 'demo',
  onAdd: comment => {
    console.log('add comment', comment)
  },
  onRemove: id => {
    console.log('remove comment', id)
  }
})
instance.use(diagramPlugin)
instance.use(docxPlugin)
instance.use(excelPlugin)
instance.use(findReplacePlugin)
instance.use(floatingToolbarPlugin)
instance.use(markdownPlugin)
instance.use(menstrualHistoryPlugin)
instance.use(mentionPlugin, {
  dataList: [
    { id: '1', name: '张三' },
    { id: '2', name: '李四' },
    { id: '3', name: '王五' },
    { id: '4', name: '赵六' },
    { id: '5', name: 'Alice' },
    { id: '6', name: 'Bob' }
  ],
  onSelect: item => {
    console.log('mention select:', item)
  },
  onClick: element => {
    console.log('mention click:', element)
  }
})
instance.use(signaturePlugin)
instance.use(specialCharactersPlugin)
instance.use(spellcheckPlugin, {
  suggestionCount: 5,
  ignoreWords: ['canvas-editor']
})
instance.use(suggestionPlugin, {
  dataList: [
    { id: '1', name: '患者男性，否认药物过敏史' },
    { id: '2', name: '患者女性，既往体健，无高血压、糖尿病等慢性病史' },
    { id: '3', name: '神志清楚，精神可，查体合作' },
    { id: '4', name: '心肺听诊未闻及明显异常' },
    { id: '5', name: '腹部平软，无压痛及反跳痛' },
    { id: '6', name: '双侧瞳孔等大等圆，对光反射灵敏' },
    { id: '7', name: '建议完善血常规、尿常规、生化全套检查' },
    { id: '8', name: '嘱患者清淡饮食，注意休息，不适随诊' }
  ],
  onSelect: item => {
    console.log('suggestion select:', item)
  }
})

// 月经史图片固定的显示高度
const MENSTRUAL_HISTORY_DISPLAY_HEIGHT = 30

// DOCX / Excel 导入的隐藏文件选择框
const docxFileInput = document.querySelector<HTMLInputElement>('#file-docx')!
docxFileInput.onchange = () => {
  const file = docxFileInput.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = event => {
    const buffer = event.target?.result
    if (buffer instanceof ArrayBuffer) {
      command.executeImportDocx({
        arrayBuffer: buffer
      })
    }
    docxFileInput.value = ''
  }
  reader.readAsArrayBuffer(file)
}

const excelFileInput = document.querySelector<HTMLInputElement>('#file-excel')!
excelFileInput.onchange = () => {
  const file = excelFileInput.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = event => {
    const buffer = event.target?.result
    if (buffer instanceof ArrayBuffer) {
      command.executeImportExcel({
        arrayBuffer: buffer
      })
    }
    excelFileInput.value = ''
  }
  reader.readAsArrayBuffer(file)
}

// 极简 stroke 风格内联 SVG 图标（16px）
function icon(paths: string): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}

interface IToolbarButton {
  label: string
  // 侧边栏按钮左侧的图标
  icon: string
  // 悬停提示（title），说明该操作的作用
  tip: string
  // 点击后的 toast 反馈文案
  toast: string
  onClick: () => void
}

interface IToolbarGroup {
  name: string
  buttons: IToolbarButton[]
}

// 侧边栏操作分组配置
const toolbarGroups: IToolbarGroup[] = [
  {
    name: '插入',
    buttons: [
      {
        label: '条形码 1D',
        icon: icon(
          '<path d="M2 3.5v9M4.8 3.5v9M6.6 3.5v9M9.4 3.5v9M11.2 3.5v9M14 3.5v9"/>'
        ),
        tip: '在光标处插入一维条形码',
        toast: '已插入一维条形码',
        onClick: () => {
          command.executeInsertBarcode1D('123456789', 200, 100, {
            format: 'CODE128',
            lineColor: '#000000',
            background: '#ffffff'
          })
        }
      },
      {
        label: '条形码 2D',
        icon: icon(
          '<rect x="2" y="2" width="4.5" height="4.5" rx="0.5"/>' +
            '<rect x="9.5" y="2" width="4.5" height="4.5" rx="0.5"/>' +
            '<rect x="2" y="9.5" width="4.5" height="4.5" rx="0.5"/>' +
            '<path d="M9.5 9.5h1.8v1.8H9.5zM13 9.5h1M9.5 13h1.2M12.7 12.2H14V14"/>'
        ),
        tip: '在光标处插入二维码',
        toast: '已插入二维码',
        onClick: () => {
          command.executeInsertBarcode2D(
            'https://hufe.club/canvas-editor',
            200,
            200
          )
        }
      },
      {
        label: '代码块',
        icon: icon('<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/>'),
        tip: '插入一段带高亮的代码块',
        toast: '已插入代码块',
        onClick: () => {
          command.executeInsertCodeblock(`function hello() {
  console.log('Hello World')
}`)
        }
      },
      {
        label: '图表',
        icon: icon(
          '<rect x="6" y="1.5" width="4" height="3.2" rx="1"/>' +
            '<rect x="1.5" y="11.3" width="4" height="3.2" rx="1"/>' +
            '<rect x="10.5" y="11.3" width="4" height="3.2" rx="1"/>' +
            '<path d="M8 4.7V8M8 8H3.5v3.3M8 8h4.5v3.3"/>'
        ),
        tip: '打开图表编辑器绘制流程图',
        toast: '已打开图表编辑器，绘制完成后自动插入',
        onClick: () => {
          command.executeLoadDiagram({
            data: `graph TD
  A[开始] --> B{判断}
  B -->|条件1| C[处理1]
  B -->|条件2| D[处理2]`,
            onDestroy: message => {
              console.log('图表编辑器关闭', message)
              if (!message || !message.data) return
              const { bounds } = message
              command.executeInsertElementList([
                {
                  type: ElementType.IMAGE,
                  width: bounds.width,
                  height: bounds.height,
                  value: message.data
                }
              ])
            }
          })
        }
      },
      {
        label: '月经史',
        icon: icon(
          '<rect x="2" y="3" width="12" height="11" rx="2"/>' +
            '<path d="M2 7h12M5.5 1.5v3M10.5 1.5v3M5.5 10v2M8 10v2M10.5 10v2"/>'
        ),
        tip: '打开月经史表单，确认后以图文形式插入',
        toast: '已打开月经史编辑弹窗',
        onClick: () => {
          command.executeLoadMenstrualHistory({
            data: {
              menarcheAge: '14',
              menstrualDuration: '5-7',
              menstrualCycle: '28-30',
              lastMenstrualPeriod: '2026-08-01'
            },
            onConfirm: result => {
              console.log('确认的月经史数据:', result)
              const { svg, width, height } = result
              // 根据固定高度等比例计算宽度
              const displayWidth = Math.round(
                (width / height) * MENSTRUAL_HISTORY_DISPLAY_HEIGHT
              )
              command.executeInsertElementList([
                {
                  type: ElementType.IMAGE,
                  width: displayWidth,
                  height: MENSTRUAL_HISTORY_DISPLAY_HEIGHT,
                  value: svg
                }
              ])
            },
            onCancel: () => {
              console.log('用户取消了操作')
            }
          })
        }
      },
      {
        label: '特殊字符',
        icon: icon(
          '<path d="M4 13.5h2.8v-1.6C4.9 10.4 3.8 9 3.8 7.2A4.2 4.2 0 0 1 8 3a4.2 4.2 0 0 1 4.2 4.2c0 1.8-1.1 3.2-3 4.7v1.6H12"/>'
        ),
        tip: '打开特殊字符选择面板',
        toast: '已打开特殊字符面板，点击字符即可插入',
        onClick: () => {
          command.executeOpenSpecialCharactersDialog({
            characters: [
              {
                name: '数学符号',
                characters: [
                  { char: '±', name: '加减号' },
                  { char: '×', name: '乘号' },
                  { char: '÷', name: '除号' },
                  { char: '∞', name: '无穷' },
                  { char: '∑', name: '求和' },
                  { char: '∏', name: '求积' }
                ]
              },
              {
                name: '货币符号',
                characters: [
                  { char: '$', name: '美元' },
                  { char: '€', name: '欧元' },
                  { char: '£', name: '英镑' },
                  { char: '¥', name: '人民币' },
                  { char: '₩', name: '韩元' },
                  { char: '₽', name: '卢布' }
                ]
              }
            ],
            onSelect: char => {
              console.log('选中了字符:', char)
            }
          })
        }
      },
      {
        label: '签名',
        icon: icon(
          '<path d="M2.5 13.5l.9-3.2 7.6-7.6a1.5 1.5 0 0 1 2.3 2.3l-7.6 7.6-3.2.9z"/>'
        ),
        tip: '打开手写签名画板',
        toast: '已打开签名画板，手写后点确认插入',
        onClick: () => {
          command.executeSignature({
            width: 390,
            height: 180,
            exportType: 'svg'
          })
        }
      }
    ]
  },
  {
    name: '导入导出',
    buttons: [
      {
        label: '导出 DOCX',
        icon: icon('<path d="M8 2.5V10M4.8 6.8L8 10l3.2-3.2M2.5 13.5h11"/>'),
        tip: '将当前文档导出为 Word 文件',
        toast: '已导出 canvas-editor.docx',
        onClick: () => {
          command.executeExportDocx({
            fileName: 'canvas-editor'
          })
        }
      },
      {
        label: '导入 DOCX',
        icon: icon('<path d="M8 10V2.5M4.8 5.7L8 2.5l3.2 3.2M2.5 13.5h11"/>'),
        tip: '选择 .docx 文件导入为文档内容',
        toast: '请选择 .docx 文件',
        onClick: () => {
          docxFileInput.click()
        }
      },
      {
        label: '导入 Excel',
        icon: icon(
          '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/>' +
            '<path d="M2 6h12M2 9.8h12M7 2.5v11"/>'
        ),
        tip: '选择 .xlsx 文件导入为表格',
        toast: '请选择 .xlsx 文件',
        onClick: () => {
          excelFileInput.click()
        }
      },
      {
        label: '导出 Markdown',
        icon: icon(
          '<path d="M2 11V5l2.8 3L7.5 5v6M11.5 8V4M11.5 11.5l2.2-2.3M11.5 11.5L9.3 9.2"/>'
        ),
        tip: '将当前文档导出为 Markdown 文件',
        toast: '已导出 canvas-editor.md',
        onClick: () => {
          const markdown = command.executeExportMarkdown()
          const blob = new Blob([markdown], {
            type: 'text/markdown;charset=utf-8'
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'canvas-editor.md'
          // 部分浏览器（如 Safari）要求锚点挂载到文档中才能触发下载
          a.style.display = 'none'
          document.body.append(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
        }
      }
    ]
  },
  {
    name: '工具',
    buttons: [
      {
        label: '转大写',
        icon: icon(
          '<path d="M2 12.5L5.3 4l3.3 8.5M3.1 10h4.4M11 12.5v-7M9 7.5l2-2 2 2"/>'
        ),
        tip: '将选中的英文文本转为大写',
        toast: '已转为大写（需先选中文字）',
        onClick: () => {
          command.executeUpperCase()
        }
      },
      {
        label: '转小写',
        icon: icon(
          '<circle cx="4.6" cy="10" r="2.6"/>' +
            '<path d="M7.2 7.4v5.2M11 5.5v7M9 10.5l2 2 2-2"/>'
        ),
        tip: '将选中的英文文本转为小写',
        toast: '已转为小写（需先选中文字）',
        onClick: () => {
          command.executeLowerCase()
        }
      },
      {
        label: '忽略拼写词',
        icon: icon(
          '<path d="M2.5 8.5L5 11 8.5 6.5M10.5 9.5l3.5 3.5M14 9.5l-3.5 3.5"/>'
        ),
        tip: '将指定单词加入拼写检查忽略列表',
        toast: '输入单词后回车，加入忽略列表',
        onClick: () => {
          const word = window.prompt('请输入要忽略的单词')
          if (word) {
            command.executeSpellcheckIgnoreWord(word)
          }
        }
      },
      {
        label: '查找替换',
        icon: icon(
          '<circle cx="7" cy="7" r="4.5"/><path d="M10.2 10.2L14 14"/>'
        ),
        tip: '查找并替换文档内容（⌘/Ctrl+F）',
        toast: '已打开查找替换面板（⌘/Ctrl+F）',
        onClick: () => {
          command.executeFindReplace({
            onClose: () => {
              console.log('查找替换面板已关闭')
            }
          })
        }
      },
      {
        label: '@提及',
        icon: icon(
          '<circle cx="8" cy="8" r="2.8"/>' +
            '<path d="M10.8 8v1.3a1.9 1.9 0 0 0 3.8 0V8a6.2 6.2 0 1 0-2.6 5"/>'
        ),
        tip: '在光标处插入 @提及',
        toast: '已在光标处打开提及候选，也可直接输入 @',
        onClick: () => {
          command.executeMention()
        }
      },
      {
        label: '添加批注',
        icon: icon(
          '<rect x="2" y="2.5" width="12" height="9" rx="2"/>' +
            '<path d="M5.5 11.5v2.8l3-2.8"/>'
        ),
        tip: '为选中的文本添加批注',
        toast: '请先用鼠标选中一段文本',
        onClick: () => {
          command.executeAddComment()
        }
      }
    ]
  }
]

let toastTimer: number | undefined
let toastRemoveTimer: number | undefined

// 顶部居中 toast 操作反馈，多次触发时替换而非堆叠
function showToast(message: string) {
  window.clearTimeout(toastTimer)
  window.clearTimeout(toastRemoveTimer)
  document.querySelector('.toast')?.remove()
  const toastEl = document.createElement('div')
  toastEl.className = 'toast'
  toastEl.textContent = message
  document.body.appendChild(toastEl)
  // 强制 reflow 以触发进入动画
  void toastEl.offsetWidth
  toastEl.classList.add('toast--visible')
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove('toast--visible')
    // 等待淡出动画结束后移除节点
    toastRemoveTimer = window.setTimeout(() => toastEl.remove(), 250)
  }, 2000)
}

// 渲染侧边栏
const sidebar = document.querySelector<HTMLElement>('#sidebar')!
toolbarGroups.forEach(group => {
  const groupEl = document.createElement('div')
  groupEl.className = 'sidebar-group'
  const titleEl = document.createElement('div')
  titleEl.className = 'sidebar-group__title'
  titleEl.textContent = group.name
  groupEl.appendChild(titleEl)
  group.buttons.forEach(button => {
    const buttonEl = document.createElement('button')
    buttonEl.type = 'button'
    buttonEl.className = 'sidebar-group__button'
    buttonEl.title = button.tip
    const iconEl = document.createElement('span')
    iconEl.className = 'sidebar-group__icon'
    iconEl.innerHTML = button.icon
    const labelEl = document.createElement('span')
    labelEl.textContent = button.label
    buttonEl.append(iconEl, labelEl)
    buttonEl.onclick = () => {
      button.onClick()
      showToast(button.toast)
    }
    groupEl.appendChild(buttonEl)
  })
  sidebar.appendChild(groupEl)
})
