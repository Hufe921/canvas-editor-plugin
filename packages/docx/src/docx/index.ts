import Color from 'color'
import {
  Editor,
  Command,
  IElement,
  ElementType,
  TitleLevel,
  // ListStyle,
  TableBorder,
  TdBorder,
  VerticalAlign as VerticalAlignEditor,
  RowFlex,
  ListType
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
  ITableCellOptions,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ShadingType,
  PageBreak,
  LevelFormat,
  CheckBox
} from 'docx'
import { saveAs, convertPxToSize } from './utils'

// 标题映射
const titleLevelToHeadingLevel = {
  [TitleLevel.FIRST]: HeadingLevel.HEADING_1,
  [TitleLevel.SECOND]: HeadingLevel.HEADING_2,
  [TitleLevel.THIRD]: HeadingLevel.HEADING_3,
  [TitleLevel.FOURTH]: HeadingLevel.HEADING_4,
  [TitleLevel.FIFTH]: HeadingLevel.HEADING_5,
  [TitleLevel.SIXTH]: HeadingLevel.HEADING_6
}

const rowFlexToAlignmentType = {
  [RowFlex.LEFT]: AlignmentType.START,
  [RowFlex.CENTER]: AlignmentType.CENTER,
  [RowFlex.RIGHT]: AlignmentType.END,
  [RowFlex.ALIGNMENT]: AlignmentType.JUSTIFIED
}

const verticalAlignEditorToVerticalAlignDocx = {
  [VerticalAlignEditor.TOP]: VerticalAlign.TOP,
  [VerticalAlignEditor.MIDDLE]: VerticalAlign.CENTER,
  [VerticalAlignEditor.BOTTOM]: VerticalAlign.BOTTOM
}

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
  if (element.type === ElementType.PAGE_BREAK) {
    return new PageBreak()
  }
  if (element.type === ElementType.CHECKBOX) {
    return new CheckBox({
      checked: true
    })
  }
  return new TextRun({
    font: element.font,
    text: element.value.toString(),
    bold: element.bold,
    size: `${(element.size || 16) / 0.75}pt`,
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
  elementList: IElement[],
  options: any
): DocxChildren {
  const children: DocxChildren = []

  let paragraphChild: ParagraphChild[] = []

  function appendParagraph(element?: IElement) {
    if (paragraphChild.length) {
      const alignment = (element && element.rowFlex) ? rowFlexToAlignmentType[element.rowFlex] : undefined
      children.push(
        new Paragraph({
          alignment,
          children: paragraphChild
        })
      )
      paragraphChild = []
    }
  }

  let targetElement = undefined // to be passed when adding a paragraph and the element has rowFlex
  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]
    if (element.type === ElementType.TITLE) {
      appendParagraph()
      children.push(
        new Paragraph({
          heading: titleLevelToHeadingLevel[element.level!],
          children:
            element.valueList?.map(child =>
              convertElementToParagraphChild(child)
            ) || []
        })
      )
    } else if (element.type === ElementType.LIST) {
      appendParagraph(element)
      // 拆分列表
      const listChildren =
        element.valueList
          ?.map(item => item.value)
          .join('')
          .split('\n')
          .map(
            (text) =>
              new Paragraph({
                numbering: {
                  reference: (!element.listType || element.listType !== ListType.OL) ? `bullet-points-1` : `numbering-1`,
                  level: 0
                },
                children: [
                  new TextRun({
                    text: `${text}`
                  })
                ]
              })
          ) || []
      children.push(...listChildren)
    } else if (element.type === ElementType.TABLE) {
      appendParagraph(element)
      const { borderType, colgroup, trList } = element
      const borderDashed = {
        style: BorderStyle.DASHED,
        size: 1,
        color: '000000'
      }
      const borderEmpty = {
        style: BorderStyle.NONE,
        size: 0,
        color: '#ffffff'
      }
      const bordersAll = {
        top: borderDashed,
        bottom: borderDashed,
        left: borderDashed,
        right: borderDashed
      }
      const bordersEmpty = {
        top: borderEmpty,
        bottom: borderEmpty,
        left: borderEmpty,
        right: borderEmpty
      }
      const tableRowList: TableRow[] = []
      for (let r = 0; r < trList!.length; r++) {
        const tdList = trList![r].tdList
        const tableCellList: TableCell[] = []
        for (let c = 0; c < tdList.length; c++) {
          const td = tdList[c]
          let borders = undefined
          if (borderType === TableBorder.ALL) {
            borders = JSON.parse(JSON.stringify(bordersAll))
          }
          if (borderType === TableBorder.EMPTY) {
            borders = JSON.parse(JSON.stringify(bordersEmpty))
          }
          if (borderType === TableBorder.EXTERNAL) {
            borders = JSON.parse(JSON.stringify(bordersEmpty))
            const lastTdIndex = tdList.length - 1
            const isTdLast = c === lastTdIndex
            const containColSpan = td.colspan > 1
            const colSpan = c + td.colspan
            const rowSpan = r + td.rowspan
            if (r === 0) {
              borders.top = borderDashed
            }
            if (isTdLast || (containColSpan && colSpan === lastTdIndex)) {
              borders.right = borderDashed
            }
            if ((r === trList!.length - 1) || (rowSpan === trList!.length - 1)) {
              borders.bottom = borderDashed
            }
            if (c === 0) {
              borders.left = borderDashed
            }
          }
          if (td.borderType === TdBorder.BOTTOM) {
            borders!.bottom = borderDashed
          }
          const verticalAlign = td.verticalAlign ? verticalAlignEditorToVerticalAlignDocx[td.verticalAlign] : undefined
          let shading = undefined
          if (td.backgroundColor) {
            shading = {
              fill: td.backgroundColor,
              type: ShadingType.CLEAR,
              color: 'auto',
            }
          }
          const tdCell: ITableCellOptions = {
            verticalAlign: verticalAlign,
            borders,
            shading,
            columnSpan: td.colspan,
            rowSpan: td.rowspan,
            children: convertElementListToDocxChildren(td.value, options) || []
          }
          tableCellList.push(
            new TableCell(tdCell)
          )
        }
        tableRowList.push(
          new TableRow({
            children: tableCellList
          })
        )
      }
      const columnWidths = colgroup?.reduce((acumm: any[], colWidth) => {
        const inches = convertPxToSize(colWidth.width)
        acumm.push(inches)
        return acumm
      }, [])
      children.push(
        new Table({
          alignment: AlignmentType.CENTER,
          columnWidths: columnWidths,
          rows: tableRowList,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE
          }
        })
      )
    } else if (element.type === ElementType.DATE) {
      paragraphChild.push(
        ...(element.valueList?.map(child =>
          convertElementToParagraphChild(child)
        ) || [])
      )
    } else {
      if (/^\n/.test(element.value)) {
        appendParagraph(element)
        element.value = element.value.replace(/^\n/, '')
      }
      paragraphChild.push(convertElementToParagraphChild(element))
      targetElement = element
    }
  }
  appendParagraph(targetElement)
  return children
}

export interface IExportDocxOption {
  fileName: string
}

export type CommandWithDocx = Command & {
  executeExportDocx(options: IExportDocxOption): void
}

export default function docxPlugin(editor: Editor) {
  const command = <CommandWithDocx>editor.command

  // 导出文档
  command.executeExportDocx = (options: IExportDocxOption) => {
    const { fileName } = options
    const {
      data: { header, main, footer }
    } = command.getValue()
    const [top, right, bottom, left] = command.getOptions().margins

    const doc = new Document({
      sections: [
        {
          headers: {
            default: new Header({
              children: convertElementListToDocxChildren(header || [], command.getOptions())
            })
          },
          footers: {
            default: new Footer({
              children: convertElementListToDocxChildren(footer || [], command.getOptions())
            })
          },
          children: convertElementListToDocxChildren(main || [], command.getOptions()),
          properties: {
            page: {
              margin: {
                top: convertPxToSize(top),
                right: convertPxToSize(right),
                bottom: convertPxToSize(bottom),
                left: convertPxToSize(left),
              },
            },
          }
        }
      ],
      numbering: {
        config: [
          {
            reference: 'bullet-points-1',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                alignment: AlignmentType.LEFT
              }
            ]
          },
          {
            reference: 'numbering-1',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.START
              }
            ]
          }
        ],
      }
    })

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${fileName}.docx`)
    })
  }
}