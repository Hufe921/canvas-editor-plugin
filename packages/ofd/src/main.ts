import Editor, {
  ElementType,
  ListStyle,
  ListType,
  RowFlex,
  TitleLevel
} from '@hufe921/canvas-editor'
import ofdPlugin from './ofd'

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

window.onload = function () {
  const container = document.querySelector<HTMLDivElement>('#editor')!
  const instance = new Editor(
    container,
    {
      main: [
        {
          type: ElementType.TITLE,
          level: TitleLevel.FIRST,
          value: '',
          valueList: [{ value: 'OFD 导出测试', size: 26, bold: true }]
        },
        {
          value:
            '段落文本：包含加粗、斜体、下划线、删除线与颜色样式，以及中英文混排 word-wrap 验证。'
        },
        { value: '\n' },
        { type: ElementType.IMAGE, value: PNG_1PX, width: 120, height: 80 },
        { value: '\n' },
        { type: ElementType.SEPARATOR, value: '' },
        {
          type: ElementType.LIST,
          value: '',
          listType: ListType.OL,
          listStyle: ListStyle.DECIMAL,
          valueList: [{ value: '\n列表项一\n列表项二' }]
        },
        {
          type: ElementType.TABLE,
          value: '',
          colgroup: [{ width: 180 }, { width: 180 }, { width: 180 }],
          trList: [
            {
              height: 40,
              tdList: [
                { colspan: 2, rowspan: 1, value: [{ value: '合并单元格' }] },
                { colspan: 1, rowspan: 2, value: [{ value: '跨行' }] }
              ]
            },
            {
              height: 40,
              tdList: [
                { colspan: 1, rowspan: 1, value: [{ value: 'A' }] },
                { colspan: 1, rowspan: 1, value: [{ value: 'B' }] }
              ]
            }
          ]
        },
        { value: '\n' },
        { type: ElementType.CHECKBOX, value: '', checkbox: { value: true } },
        { value: ' 复选框' }
      ],
      footer: [{ value: '页脚', size: 12 }]
    },
    {
      pageNumber: {
        disabled: false,
        format: '第 {pageNo} 页 / 共 {pageCount} 页',
        rowFlex: RowFlex.CENTER,
        size: 12
      }
    }
  )
  instance.use(ofdPlugin)
  // 便于调试/自动化测试
  ;(window as any).__editor = instance

  document.querySelector<HTMLButtonElement>('#export-ofd')!.onclick =
    async () => {
      try {
        const blob = await instance.command.executeExportOfd({
          fileName: 'canvas-editor-demo'
        })
        console.log('OFD_EXPORT_SUCCESS', blob.size, blob.type)
      } catch (error) {
        console.error('OFD_EXPORT_ERROR', error)
      }
    }

  const fileInput = document.querySelector<HTMLInputElement>('#file-ofd')!
  document.querySelector<HTMLButtonElement>('#import-ofd')!.onclick = () => {
    fileInput.click()
  }
  fileInput.onchange = async () => {
    const file = fileInput?.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      instance.command.executeImportOfd({ arrayBuffer: buffer })
      console.log('OFD_IMPORT_SUCCESS', file.name)
    } catch (error) {
      console.error('OFD_IMPORT_ERROR', error)
    }
    fileInput.value = ''
  }
}
