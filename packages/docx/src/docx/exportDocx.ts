import Color from 'color'
import {
  IElement,
  ElementType,
  TitleLevel,
  ListStyle,
  Command,
  RowFlex,
  TableBorder,
  VerticalAlign
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
  BorderStyle,
  AlignmentType,
  VerticalAlign as DocxVerticalAlign,
  CheckBox,
  PageBreak,
  HeightRule,
  LineRuleType
} from 'docx'
import { saveAs } from './utils'

type LineRuleValue = (typeof LineRuleType)[keyof typeof LineRuleType]

// 标题映射
const titleLevelToHeadingLevel = {
  [TitleLevel.FIRST]: HeadingLevel.HEADING_1,
  [TitleLevel.SECOND]: HeadingLevel.HEADING_2,
  [TitleLevel.THIRD]: HeadingLevel.HEADING_3,
  [TitleLevel.FOURTH]: HeadingLevel.HEADING_4,
  [TitleLevel.FIFTH]: HeadingLevel.HEADING_5,
  [TitleLevel.SIXTH]: HeadingLevel.HEADING_6
}

// 行高/段距/宽高数值转换：px -> twips（1px ≈ 15twips）
function pxToTwip(px: number): number {
  return Math.round(px * 15)
}

// 段落对齐映射
type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType]
function getParagraphAlignment(rowFlex?: RowFlex): DocxAlignment | undefined {
  switch (rowFlex) {
    case RowFlex.LEFT:
      return AlignmentType.LEFT
    case RowFlex.CENTER:
      return AlignmentType.CENTER
    case RowFlex.RIGHT:
      return AlignmentType.RIGHT
    case RowFlex.ALIGNMENT:
      return AlignmentType.JUSTIFIED
    default:
      return undefined
  }
}

// 单元格垂直对齐映射
type DocxCellVerticalAlign =
  (typeof DocxVerticalAlign)[keyof typeof DocxVerticalAlign]
function getCellVerticalAlign(
  align?: VerticalAlign
): DocxCellVerticalAlign | undefined {
  switch (align) {
    case VerticalAlign.TOP:
      return DocxVerticalAlign.TOP
    case VerticalAlign.MIDDLE:
      return DocxVerticalAlign.CENTER
    case VerticalAlign.BOTTOM:
      return DocxVerticalAlign.BOTTOM
    default:
      return undefined
  }
}

// 表格边框配置
function getTableBorders(borderType?: TableBorder) {
  const defaultBorder = { style: BorderStyle.SINGLE, size: 1, color: '#000000' }
  const emptyBorder = { style: BorderStyle.NIL, size: 0, color: '#000000' }
  switch (borderType) {
    case TableBorder.ALL:
      return {
        top: defaultBorder,
        bottom: defaultBorder,
        left: defaultBorder,
        right: defaultBorder,
        insideHorizontal: defaultBorder,
        insideVertical: defaultBorder
      }
    case TableBorder.EXTERNAL:
      return {
        top: defaultBorder,
        bottom: defaultBorder,
        left: defaultBorder,
        right: defaultBorder,
        insideHorizontal: emptyBorder,
        insideVertical: emptyBorder
      }
    case TableBorder.EMPTY:
      return {
        top: emptyBorder,
        bottom: emptyBorder,
        left: emptyBorder,
        right: emptyBorder,
        insideHorizontal: emptyBorder,
        insideVertical: emptyBorder
      }
    default:
      return undefined
  }
}

function inferImageType(data: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const match = data.match(/^data:image\/(png|jpg|jpeg|gif|bmp);base64,/i)
  if (match) {
    const ext = match[1].toLowerCase()
    return ext === 'jpeg' ? 'jpg' : (ext as 'png' | 'jpg' | 'gif' | 'bmp')
  }
  return 'png'
}

function stripBase64Prefix(data: string): string {
  return data.replace(/^data:image\/[^;]+;base64,/, '')
}

function convertElementToParagraphChild(element: IElement): ParagraphChild {
  if (element.type === ElementType.IMAGE) {
    return new ImageRun({
      type: inferImageType(element.value),
      data: stripBase64Prefix(element.value),
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
      checked: !!element.checkbox?.value
    })
  }
  return new TextRun({
    font: element.font,
    text: element.value,
    bold: element.bold,
    size: `${(element.size || 16) / 0.75}pt`,
    color: Color(element.color).hex() || '#000000',
    italics: element.italic,
    strike: element.strikeout,
    shading: element.highlight
      ? { fill: Color(element.highlight).hex() }
      : undefined,
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
  let paragraphAlignment: DocxAlignment | undefined
  let paragraphSpacing: { line: number; lineRule: LineRuleValue } | undefined

  function appendParagraph() {
    if (paragraphChild.length) {
      children.push(
        new Paragraph({
          alignment: paragraphAlignment,
          spacing: paragraphSpacing,
          children: paragraphChild
        })
      )
      paragraphChild = []
      paragraphAlignment = undefined
      paragraphSpacing = undefined
    }
  }

  for (let e = 0; e < elementList.length; e++) {
    const element = elementList[e]
    if (element.type === ElementType.TITLE) {
      const prevElement = e > 0 ? elementList[e - 1] : undefined
      if (
        prevElement &&
        (!prevElement.value || /\n$/.test(prevElement.value)) &&
        paragraphChild.length
      ) {
        prevElement.value = prevElement.value.replace(/\n$/, '')
        if (prevElement.value) {
          paragraphChild[paragraphChild.length - 1] =
            convertElementToParagraphChild(prevElement)
        } else if (paragraphChild.length === 1) {
          paragraphChild = []
          paragraphAlignment = undefined
          paragraphSpacing = undefined
        } else {
          paragraphChild = paragraphChild.slice(0, -1) as ParagraphChild[]
        }
      }
      appendParagraph()
      children.push(
        new Paragraph({
          heading: titleLevelToHeadingLevel[element.level!],
          alignment: getParagraphAlignment(element.rowFlex),
          spacing: element.rowMargin
            ? { line: pxToTwip(element.rowMargin), lineRule: LineRuleType.AUTO }
            : undefined,
          children:
            element.valueList?.map(child =>
              convertElementToParagraphChild(child)
            ) || []
        })
      )
    } else if (element.type === ElementType.LIST) {
      appendParagraph()
      // 拆分列表
      const listChildren =
        element.valueList
          ?.map(item => item.value)
          .join('')
          .split('\n')
          .filter((text, i) => i !== 0 || text !== '')
          .map(
            (text, index) =>
              new Paragraph({
                alignment: getParagraphAlignment(element.rowFlex),
                spacing: element.rowMargin
                  ? {
                      line: pxToTwip(element.rowMargin),
                      lineRule: LineRuleType.AUTO
                    }
                  : undefined,
                children: [
                  new TextRun({
                    text: `${
                      !element.listStyle ||
                      element.listStyle === ListStyle.DECIMAL
                        ? `${index + 1}. `
                        : `• `
                    }${text}`
                  })
                ]
              })
          ) || []
      children.push(...listChildren)
    } else if (element.type === ElementType.TABLE) {
      appendParagraph()
      const { trList, colgroup, borderType } = element
      const tableRowList: TableRow[] = []
      const columnWidths = colgroup?.map(c => pxToTwip(c.width))
      for (let r = 0; r < trList!.length; r++) {
        const tr = trList![r]
        const tdList = tr.tdList
        const tableCellList: TableCell[] = []
        for (let c = 0; c < tdList.length; c++) {
          const td = tdList[c]
          tableCellList.push(
            new TableCell({
              columnSpan: td.colspan,
              rowSpan: td.rowspan,
              shading: td.backgroundColor
                ? { fill: Color(td.backgroundColor).hex() }
                : undefined,
              verticalAlign: getCellVerticalAlign(td.verticalAlign),
              width: td.width
                ? { size: pxToTwip(td.width), type: WidthType.DXA }
                : undefined,
              children: convertElementListToDocxChildren(td.value) || []
            })
          )
        }
        tableRowList.push(
          new TableRow({
            height: tr.height
              ? { value: pxToTwip(tr.height), rule: HeightRule.ATLEAST }
              : undefined,
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
          },
          columnWidths,
          borders: getTableBorders(borderType)
        })
      )
    } else if (element.type === ElementType.SEPARATOR) {
      appendParagraph()
      children.push(
        new Paragraph({
          border: {
            bottom: {
              color: element.color || '#000000',
              space: 1,
              style: element.dashArray?.length
                ? BorderStyle.DASHED
                : BorderStyle.SINGLE,
              size: 6
            }
          },
          spacing: { after: 0, before: 0 },
          children: []
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
        appendParagraph()
        element.value = element.value.replace(/^\n/, '')
      }
      if (paragraphChild.length === 0) {
        paragraphAlignment = getParagraphAlignment(element.rowFlex)
        paragraphSpacing = element.rowMargin
          ? { line: pxToTwip(element.rowMargin), lineRule: LineRuleType.AUTO }
          : undefined
      }
      paragraphChild.push(convertElementToParagraphChild(element))
    }
  }
  // 将末尾未闭合的普通段落使用已记录的对齐/行距属性创建
  if (paragraphChild.length) {
    children.push(
      new Paragraph({
        alignment: paragraphAlignment,
        spacing: paragraphSpacing,
        children: paragraphChild
      })
    )
  }
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

export default function (command: Command) {
  return function (options: IExportDocxOption) {
    const { fileName } = options
    const {
      data: { header, main, footer }
    } = command.getValue()

    const doc = new Document({
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

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${fileName}.docx`)
    })
  }
}
