import Color from 'color'
import {
  IElement,
  ElementType,
  TitleLevel,
  ListStyle,
  Command,
  RowFlex,
  IEditorData
} from '@hufe921/canvas-editor'
import {
  Document,
  Packer,
  Paragraph,
  Header,
  Footer,
  Table,
  HeadingLevel,
  ParagraphChild,
  TextRun,
  Tab,
  ExternalHyperlink,
  ImageRun,
  WidthType,
  TableRow,
  TableCell,
  MathRun,
  AlignmentType
} from 'docx'
import { saveAs } from './utils'

// 标题映射
const titleLevelToHeadingLevel = {
  [TitleLevel.FIRST]: HeadingLevel.HEADING_1,
  [TitleLevel.SECOND]: HeadingLevel.HEADING_2,
  [TitleLevel.THIRD]: HeadingLevel.HEADING_3,
  [TitleLevel.FOURTH]: HeadingLevel.HEADING_4,
  [TitleLevel.FIFTH]: HeadingLevel.HEADING_5,
  [TitleLevel.SIXTH]: HeadingLevel.HEADING_6
}

// 水平对齐映射
const RowFlexToAlignmentType = {
  [RowFlex.LEFT]: AlignmentType.LEFT,
  [RowFlex.CENTER]: AlignmentType.CENTER,
  [RowFlex.RIGHT]: AlignmentType.RIGHT,
  [RowFlex.ALIGNMENT]: AlignmentType.BOTH
}

type PxToPtHandler = (size?: number) => number

let pxToPtHandler: PxToPtHandler = (size?: number) => (size || 16) / 0.75

function convertElementToParagraphChild(element: IElement): ParagraphChild {
  if (element.type === ElementType.IMAGE) {
    return new ImageRun({
      data: element.value,
      transformation: {
        width: element.width!,
        height: element.height!
      }
    })
  }
  if (element.type === ElementType.HYPERLINK) {
    return new ExternalHyperlink({
      children: [
        new TextRun({
          text: element.valueList?.map(child => child.value).join(''),
          style: 'Hyperlink'
        })
      ],
      link: element.url!
    })
  }
  if (element.type === ElementType.TAB) {
    return new TextRun({
      children: [new Tab()]
    })
  }
  if (element.type === ElementType.LATEX) {
    return new MathRun(element.value)
  }
  return new TextRun({
    font: element.font,
    text: element.value,
    bold: element.bold,
    size: `${pxToPtHandler(element.size)}pt`,
    color: Color(element.color).hex() || '#000000',
    italics: element.italic,
    strike: element.strikeout,
    highlight: element.highlight ? Color(element.highlight).hex() : undefined,
    superScript: element.type === ElementType.SUPERSCRIPT,
    subScript: element.type === ElementType.SUBSCRIPT,
    underline: element.underline ? {} : undefined
  })
}

type DocxChildren = (Paragraph | Table)[]
function convertElementListToDocxChildren(
  elementList: IElement[]
): DocxChildren {
  const children: DocxChildren = []

  let paragraphChild: ParagraphChild[] = []

  let alignment: AlignmentType | undefined = undefined

  function appendParagraph() {
    if (paragraphChild.length) {
      children.push(
        new Paragraph({
          alignment,
          children: paragraphChild
        })
      )
      paragraphChild = []
      alignment = undefined
    }
  }

  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]
    if (element.type === ElementType.TITLE) {
      appendParagraph()
      const valueList = element.valueList || []
      const rowFlex = valueList[0]?.rowFlex
      children.push(
        new Paragraph({
          heading: titleLevelToHeadingLevel[element.level!],
          alignment: rowFlex ? RowFlexToAlignmentType[rowFlex] : undefined,
          children: valueList.map(child =>
            convertElementToParagraphChild(child)
          )
        })
      )
    } else if (element.type === ElementType.LIST) {
      appendParagraph()
      // 拆分列表
      const valueList = element.valueList || []
      const isDecimal =
        !element.listStyle || element.listStyle === ListStyle.DECIMAL
      valueList.reduce((count, cur) => {
        if (cur.value !== '\n') {
          cur.value
            .replace(/^\n/, '')
            .split('\n')
            .forEach(text => {
              children.push(
                new Paragraph({
                  alignment: cur.rowFlex
                    ? RowFlexToAlignmentType[cur.rowFlex]
                    : undefined,
                  children: [
                    new TextRun({
                      text: `${isDecimal ? `${++count}. ` : `• `}${text}`
                    })
                  ]
                })
              )
            })
        }
        return count
      }, 0)
    } else if (element.type === ElementType.TABLE) {
      appendParagraph()
      const { trList } = element
      const tableRowList: TableRow[] = []
      for (let r = 0; r < trList!.length; r++) {
        const tdList = trList![r].tdList
        const tableCellList: TableCell[] = []
        for (let c = 0; c < tdList.length; c++) {
          const td = tdList[c]
          tableCellList.push(
            new TableCell({
              columnSpan: td.colspan,
              rowSpan: td.rowspan,
              children: convertElementListToDocxChildren(td.value) || []
            })
          )
        }
        tableRowList.push(
          new TableRow({
            children: tableCellList
          })
        )
      }
      children.push(
        new Table({
          rows: tableRowList,
          width: {
            size: '100%',
            type: WidthType.PERCENTAGE
          }
        })
      )
    } else if (element.type === ElementType.DATE) {
      const valueList = element.valueList || []
      const rowFlex = valueList[0]?.rowFlex
      if (rowFlex && !alignment) {
        alignment = RowFlexToAlignmentType[rowFlex]
      }
      paragraphChild.push(
        ...valueList.map(child => convertElementToParagraphChild(child))
      )
    } else {
      let suffixBreak
      if (/^\n/.test(element.value)) {
        appendParagraph()
        element.value = element.value.replace(/^\n/, '')
      } else if (/\n$/.test(element.value)) {
        suffixBreak = true
        element.value = element.value.replace(/\n$/, '')
      }
      if (element.rowFlex && !alignment) {
        alignment = RowFlexToAlignmentType[element.rowFlex]
      }
      paragraphChild.push(convertElementToParagraphChild(element))
      suffixBreak && appendParagraph()
    }
  }
  appendParagraph()
  return children
}

export interface IExportDocxOption {
  fileName: string
}

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeExportDocx(options: IExportDocxOption): void
  }
}

export function createDocumentByData(data: IEditorData) {
  const { header, main, footer } = data
  return new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: convertElementListToDocxChildren(header || [])
          })
        },
        footers: {
          default: new Footer({
            children: convertElementListToDocxChildren(footer || [])
          })
        },
        children: convertElementListToDocxChildren(main || [])
      }
    ]
  })
}

export function setPxToPtHandler(handler: PxToPtHandler) {
  if (typeof handler === 'function') {
    pxToPtHandler = handler
  }
}

export default function (command: Command) {
  return function (options: IExportDocxOption) {
    const { fileName } = options
    const { data } = command.getValue()
    const doc = createDocumentByData(data)
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${fileName}.docx`)
    })
  }
}
