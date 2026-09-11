import Color from 'color'
import {
  IElement,
  ElementType,
  TitleLevel,
  ListStyle,
  Editor,
  RowFlex,
  TableBorder,
  VerticalAlign,
  ImageDisplay,
  PaperDirection,
  NumberType
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
  Math as DocxMath,
  BorderStyle,
  AlignmentType,
  VerticalAlign as DocxVerticalAlign,
  CheckBox,
  PageBreak,
  HeightRule,
  LineRuleType,
  PageOrientation,
  TableOfContents,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  NumberFormat,
  PageNumber,
  ImportedXmlComponent
} from 'docx'
import {
  loadImage,
  saveAs,
  measureFontMetrics,
  measureTextWidth
} from './utils'

type LineRuleValue = (typeof LineRuleType)[keyof typeof LineRuleType]

// ====================================================================
// 常量与模块状态
// =====================================================================

// 标题映射
const titleLevelToHeadingLevel = {
  [TitleLevel.FIRST]: HeadingLevel.HEADING_1,
  [TitleLevel.SECOND]: HeadingLevel.HEADING_2,
  [TitleLevel.THIRD]: HeadingLevel.HEADING_3,
  [TitleLevel.FOURTH]: HeadingLevel.HEADING_4,
  [TitleLevel.FIFTH]: HeadingLevel.HEADING_5,
  [TitleLevel.SIXTH]: HeadingLevel.HEADING_6
}

// 编辑器默认页面尺寸与页边距（A4：794x1123、[100,120,100,120]）
const DEFAULT_PAGE_WIDTH = 794
const DEFAULT_PAGE_HEIGHT = 1123
const DEFAULT_PAGE_MARGIN: [number, number, number, number] = [
  100, 120, 100, 120
]

// 行高/段距/宽高数值转换：px -> twips（1px ≈ 15twips）
// ====================================================================
// 工具函数
// =====================================================================

// px -> twips（1px = 15twips）
function pxToTwip(px: number): number {
  return Math.round(px * 15)
}

// 浮动图片定位转换：px -> EMU（1px = 9525EMU）
function pxToEMU(px: number): number {
  return Math.round(px * 9525)
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

// 编辑器默认控件占位色（canvas-editor defaultControlOption）
const CONTROL_PLACEHOLDER_COLOR = '#9C9B9B'

// 导出上下文：默认字号/行距（每次导出前从编辑器配置更新），
// 控件勾选组件计数（valueSets 按出现顺序对应）
let exportDefaultSize = 16
let exportDefaultRowMargin = 1
let exportBasicRowMarginHeight = 8
const checkboxIndexByControlId = new Map<string, number>()

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

// 将编辑器渲染的 laTexSVG 栅格化为 png，保证公式在 word 中可见
async function laTexToPngDataUrl(
  laTexSVG: string,
  width?: number,
  height?: number
): Promise<string | undefined> {
  try {
    const svgUrl = URL.createObjectURL(
      new Blob([laTexSVG], { type: 'image/svg+xml;charset=utf-8' })
    )
    try {
      const img = await loadImage(svgUrl)
      const canvasWidth = width || img.naturalWidth || 100
      const canvasHeight = height || img.naturalHeight || 30
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const context = canvas.getContext('2d')
      if (!context) return undefined
      context.drawImage(img, 0, 0, canvasWidth, canvasHeight)
      return canvas.toDataURL('image/png')
    } finally {
      URL.revokeObjectURL(svgUrl)
    }
  } catch {
    return undefined
  }
}

// ====================================================================
// 编辑器元素 -> docx 转换
// =====================================================================

async function convertElementToParagraphChild(
  element: IElement
): Promise<ParagraphChild> {
  if (element.type === ElementType.IMAGE) {
    const isBehindText = element.imgDisplay === ImageDisplay.FLOAT_BOTTOM
    const isFloat =
      isBehindText || element.imgDisplay === ImageDisplay.FLOAT_TOP
    const floatPosition = element.imgFloatPosition
    return new ImageRun({
      type: inferImageType(element.value),
      data: stripBase64Prefix(element.value),
      transformation: {
        width: element.width!,
        height: element.height!
      },
      // 浮动图片：衬于文字下方/浮于文字上方时按页面坐标绝对定位
      floating:
        isFloat && floatPosition
          ? {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                offset: pxToEMU(floatPosition.x)
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                offset: pxToEMU(floatPosition.y)
              },
              behindDocument: isBehindText,
              allowOverlap: true,
              wrap: { type: TextWrappingType.NONE }
            }
          : undefined
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
    // 优先使用渲染后的 svg 位图；兜底输出 OMML 公式（MathRun 需被 Math 包裹，否则会被 Word 忽略）
    if (element.laTexSVG) {
      const pngDataUrl = await laTexToPngDataUrl(
        element.laTexSVG,
        element.width,
        element.height
      )
      if (pngDataUrl) {
        return new ImageRun({
          type: 'png',
          data: stripBase64Prefix(pngDataUrl),
          transformation: {
            width: element.width || 100,
            height: element.height || 30
          }
        })
      }
    }
    return new DocxMath({ children: [new MathRun(element.value)] })
  }
  if (element.type === ElementType.PAGE_BREAK) {
    return new PageBreak()
  }
  if (element.type === ElementType.CHECKBOX) {
    return new CheckBox({
      checked: !!element.checkbox?.value
    })
  }
  // 控件组件：占位提示导出为灰字（与编辑器显示一致）
  if (element.controlComponent === 'placeholder') {
    return new TextRun({
      text: element.value || '',
      color: CONTROL_PLACEHOLDER_COLOR
    })
  }
  // 复选框/单选控件组件：按 control.code 与 valueSets 对应判断勾选
  if (
    element.controlComponent === 'checkbox' ||
    element.controlComponent === 'radio'
  ) {
    const control: any = element.control
    const valueSets = control?.valueSets || []
    const index = checkboxIndexByControlId.get(element.controlId || '') || 0
    checkboxIndexByControlId.set(element.controlId || '', index + 1)
    const valueSet = valueSets[index]
    const checked = valueSet
      ? String(control?.code || '')
          .split(',')
          .includes(valueSet.code)
      : false
    return new CheckBox({ checked })
  }
  return new TextRun({
    font: element.font,
    text: element.value,
    bold: element.bold,
    size: Math.round((element.size || exportDefaultSize) * 1.5),
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

// 压缩控件元素（getValue 经 zipElementList 后的形态）-> 导出内容：
// 复选/单选 -> Word 复选框 + 选项文本；其它 -> {前缀 + 值/占位(灰) + 后缀}
async function convertControlToParagraphChildren(
  element: IElement
): Promise<ParagraphChild[]> {
  const control: any = element.control
  if (!control) return []
  const children: ParagraphChild[] = []
  const prefix = control.prefix ?? '{'
  const postfix = control.postfix ?? '}'
  const valueSets: any[] = control.valueSets || []
  // 控件值区域下划线（签名线样式：值/占位/空白撑位均带下划线）
  const isUnderline = control.underline === true
  const size = element.size || exportDefaultSize
  if (
    (control.type === 'checkbox' || control.type === 'radio') &&
    valueSets.length
  ) {
    const codes = String(control.code || '').split(',')
    for (const valueSet of valueSets) {
      children.push(
        new CheckBox({
          checked:
            control.type === 'radio'
              ? control.code === valueSet.code
              : codes.includes(valueSet.code)
        })
      )
      children.push(new TextRun({ text: valueSet.value }))
    }
    return children
  }
  children.push(new TextRun({ text: prefix }))
  const valueList: IElement[] = control.value || []
  if (valueList.length) {
    for (const valueElement of valueList) {
      const child = await convertElementToParagraphChild(
        isUnderline ? { ...valueElement, underline: true } : valueElement
      )
      children.push(child)
    }
  } else if (control.placeholder) {
    children.push(
      new TextRun({
        text: control.placeholder,
        color: CONTROL_PLACEHOLDER_COLOR,
        ...(isUnderline ? { underline: {} } : {})
      })
    )
  } else if (isUnderline) {
    // 空值签名线：按 minWidth 输出下划线空白（不间断空格，Word 行尾也保下划线）
    const minWidth = control.minWidth || 0
    const spaceCount = minWidth ? Math.ceil(minWidth / (size / 2)) : 0
    if (spaceCount > 0) {
      children.push(
        new TextRun({
          text: '\u00A0'.repeat(spaceCount),
          ...(isUnderline ? { underline: {} } : {})
        })
      )
    }
  }
  children.push(new TextRun({ text: postfix }))
  return children
}


type DocxChildren = (Paragraph | Table | TableOfContents)[]
async function convertElementListToDocxChildren(
  elementList: IElement[]
): Promise<DocxChildren> {
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
      appendParagraph()
      children.push(
        new Paragraph({
          heading: titleLevelToHeadingLevel[element.level!],
          alignment: getParagraphAlignment(element.rowFlex),
          spacing: buildParagraphSpacing(element),
          children: element.valueList
            ? await Promise.all(
                element.valueList.map(child =>
                  convertElementToParagraphChild(child)
                )
              )
            : []
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
                spacing: buildParagraphSpacing(element),
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
              children: td.value
                ? await convertElementListToDocxChildren(td.value)
                : []
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
        ...(await Promise.all(
          (element.valueList || []).map(child =>
            convertElementToParagraphChild(child)
          )
        ))
      )
    } else {
      // 压缩控件元素（getValue 的 zip 形态）：按编辑器样式导出
      if (element.type === ElementType.CONTROL && element.control) {
        paragraphChild.push(
          ...(await convertControlToParagraphChildren(element))
        )
        continue
      }
      // 控件边界为隐式断行：离开控件（前元素有 controlId 且不同）时换行；
      // 进入控件（标签+控件）同行
      const prevControlId = elementList[e - 1]?.controlId
      if (prevControlId && prevControlId !== element.controlId) {
        appendParagraph()
      }
      const elementValue = element.value ?? ''
      if (/^\n/.test(elementValue)) {
        // 控件行尾 \n 的换行职责可能已被控件边界断行履行，避免重复空段
        const prevIsControlEnd = !!elementList[e - 1]?.controlId
        appendParagraph()
        element.value = elementValue.replace(/^\n/, '')
        if (prevIsControlEnd && !element.value) continue
      }

      // 下一个元素为块级时去掉尾部换行，避免标题/表格等前面多出空行
      const nextElement = elementList[e + 1]
      const nextType = nextElement?.type
      const isNextBlockElement =
        nextType !== undefined &&
        [
          ElementType.TITLE,
          ElementType.LIST,
          ElementType.TABLE,
          ElementType.SEPARATOR
        ].includes(nextType)
      const value = isNextBlockElement
        ? element.value.replace(/\n$/, '')
        : element.value
      // 编辑器内 \n 表示换行，docx 中按行拆分为独立段落，保证每行的对齐/行距正确（#13 换行丢失）
      const segments = value.split('\n')
      let lastNonEmptyIndex = -1
      for (let i = 0; i < segments.length; i++) {
        if (segments[i]) lastNonEmptyIndex = i
      }
      for (let s = 0; s < segments.length; s++) {
        const segment = segments[s]
        if (s > 0) appendParagraph()
        const isComponentElement =
          element.controlComponent === 'checkbox' ||
          element.controlComponent === 'radio' ||
          element.type === ElementType.CHECKBOX
        if (
          segment ||
          (s === 0 && isComponentElement) ||
          s < lastNonEmptyIndex
        ) {
          if (paragraphChild.length === 0) {
            paragraphAlignment = getParagraphAlignment(element.rowFlex)
            paragraphSpacing = buildParagraphSpacing(element)
          }
          paragraphChild.push(
            await convertElementToParagraphChild({ ...element, value: segment })
          )
        }
      }
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ====================================================================
// 水印
// =====================================================================

// 编辑器水印 -> Word 水印（置于页眉：文字用 VML textpath，图片用浮动定位）
function buildWatermarkChildren(
  watermark: Record<string, any>,
  pageWidthPt: number,
  pageHeightPt: number
): (Paragraph | ImportedXmlComponent)[] {
  // fromXmlString 会把内容包进无效的 <undefined> 根标签（Word 直接丢弃），
  // 需取出其中真正的 <w:p> 元素
  const fromXmlParagraph = (xml: string) =>
    (
      ImportedXmlComponent.fromXmlString(xml) as unknown as {
        root: Paragraph[]
      }
    ).root[0] ?? new Paragraph({ children: [] })
  if (watermark.type === 'image' && watermark.data) {
    const data = String(watermark.data)
    return [
      new Paragraph({
        children: [
          new ImageRun({
            type: inferImageType(data),
            data: stripBase64Prefix(data),
            transformation: {
              width: watermark.width || 300,
              height: watermark.height || 300
            },
            floating: {
              horizontalPosition: {
                relative: HorizontalPositionRelativeFrom.PAGE,
                align: 'center'
              },
              verticalPosition: {
                relative: VerticalPositionRelativeFrom.PAGE,
                align: 'center'
              },
              behindDocument: watermark.layer !== 'top',
              allowOverlap: true,
              wrap: { type: TextWrappingType.NONE }
            }
          })
        ]
      })
    ]
  }
  // 文字水印：编辑器以 size px 字号旋转 -45° 居中绘制；Word v:textpath 的
  // fitshape 会把文本拉伸填满 shape，因此 shape 尺寸按文本实测宽高换算，
  // 保证渲染字形大小与编辑器一致
  const text = escapeXml(String(watermark.data || ''))
  if (!text) return []
  const fill = watermark.color || '#AEB5C0'
  const opacity = watermark.opacity !== undefined ? watermark.opacity : 0.3
  const font = escapeXml(String(watermark.font || 'Microsoft YaHei'))
  const size = watermark.size || 200
  const textWidthPx = measureTextWidth(
    String(watermark.font || 'Microsoft YaHei'),
    size,
    String(watermark.data || '')
  )
  const { ascent, descent } = measureFontMetrics(
    String(watermark.font || 'Microsoft YaHei'),
    size
  )
  const textHeightPx = ascent + descent
  const widthPt = Math.round(textWidthPx * 1.15 * 0.75)
  const heightPt = Math.round(textHeightPx * 1.4 * 0.75)

  const buildTextWatermarkShape = (positionStyle: string): string =>
    `<w:p><w:pPr><w:rPr><w:noProof/></w:rPr></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:pict><v:shapetype id="_x0000_t136" coordsize="21600,21600" o:spt="136" adj="10800" path="m@7,l@8,m@5,21600l@6,21600e"><v:formulas><v:f eqn="sum #0 0 10800"/><v:f eqn="prod #0 2 1"/><v:f eqn="sum 21600 0 @1"/><v:f eqn="sum 0 0 @2"/><v:f eqn="sum 21600 0 @3"/><v:f eqn="if @0 @3 0"/><v:f eqn="if @0 21600 @1"/><v:f eqn="if @0 0 @2"/><v:f eqn="if @0 @4 21600"/><v:f eqn="mid @5 @6"/><v:f eqn="mid @8 @5"/><v:f eqn="mid @7 @8"/><v:f eqn="mid @6 @7"/><v:f eqn="sum @6 0 @5"/></v:formulas><v:path textpathok="t" o:connecttype="custom" o:connectlocs="@9,0;@10,10800;@11,21600;@12,10800" o:connectangles="270,180,90,0"/><v:textpath on="t" fitshape="t"/></v:shapetype><v:shape id="PowerPlusWaterMarkObject${Math.round(Math.random() * 1000000)}" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;${positionStyle}width:${widthPt}pt;height:${heightPt}pt;rotation:315;z-index:-251654144;mso-wrap-edited:f;${''}" o:allowincell="f" fillcolor="${fill}" stroked="f"><v:fill opacity="${opacity}"/><v:textpath style="font-family:'${font}';font-size:1pt" string="${text}"/></v:shape></w:pict></w:r></w:p>`

  // repeat 平铺：按编辑器逻辑（对角线 + 2×gap 为平铺单元）铺满页面
  if (watermark.repeat) {
    const diagonalPx = Math.sqrt(
      textWidthPx * textWidthPx + textHeightPx * textHeightPx
    )
    const cellWidthPx = diagonalPx + (watermark.gap?.[0] ?? 10) * 2
    const cellHeightPx = diagonalPx + (watermark.gap?.[1] ?? 10) * 2
    const shapes: string[] = []
    const cols = Math.max(
      1,
      Math.ceil(pageWidthPt / ((cellWidthPx * 0.75) as number))
    )
    const rows = Math.max(
      1,
      Math.ceil(pageHeightPt / ((cellHeightPx * 0.75) as number))
    )
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const leftPt = Math.round(col * cellWidthPx * 0.75)
        const topPt = Math.round(row * cellHeightPx * 0.75)
        shapes.push(
          buildTextWatermarkShape(
            `margin-left:${leftPt}pt;margin-top:${topPt}pt;mso-position-horizontal-relative:page;mso-position-vertical-relative:page;`
          )
        )
      }
    }
    return shapes.map(xml => fromXmlParagraph(xml))
  }

  // 单次模式：页面居中（与编辑器页面中心一致）
  return [
    fromXmlParagraph(
      buildTextWatermarkShape(
        'margin-left:0;margin-top:0;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin;'
      )
    )
  ]
}

// 编辑器行高公式（Draw.getElementRowMargin + computeRowList）：
// 行高 = 字面高(ascent+descent) + 上下各 8px × 字号系数 × 行距倍数
// 字号系数：12-30 为 1，小于 12 按比例缩小，大于 30 按比例放大
function buildParagraphSpacing(element: IElement) {
  const size = element.size || exportDefaultSize
  let ratio = 1
  if (size < 12) {
    ratio = size / 12
  } else if (size > 30) {
    ratio = 1 + (size - 30) / 30
  }
  const rowMarginPx =
    exportBasicRowMarginHeight *
    ratio *
    (element.rowMargin ?? exportDefaultRowMargin)
  const { ascent, descent } = measureFontMetrics(element.font, size)
  const lineHeightPx = ascent + descent + rowMarginPx * 2
  return {
    line: pxToTwip(lineHeightPx),
    lineRule: LineRuleType.AT_LEAST,
    before: 0,
    after: 0
  }
}

// ====================================================================
// 导出入口
// =====================================================================

export interface IExportDocxOption {
  fileName: string
  // 是否在文档开头插入目录（Word 中更新域后生成，依赖标题样式）
  toc?: boolean
}

declare module '@hufe921/canvas-editor' {
  interface Command {
    executeExportDocx(options: IExportDocxOption): Promise<Blob>
  }
}

export default function (editor: Editor) {
  return async function (options: IExportDocxOption): Promise<Blob> {
    checkboxIndexByControlId.clear()
    const { fileName, toc } = options
    const {
      data: { header, main, footer },
      options: editorOptions
    } = editor.command.getValue()
    // 默认字号/行距跟随编辑器配置，需在转换前更新
    exportDefaultSize = editorOptions.defaultSize || 16
    exportDefaultRowMargin = editorOptions.defaultRowMargin || 1
    exportBasicRowMarginHeight = editorOptions.defaultBasicRowMarginHeight || 8

    const children = await convertElementListToDocxChildren(main || [])
    if (toc) {
      children.unshift(
        new TableOfContents('目录', {
          hyperlink: true,
          headingStyleRange: '1-6'
        })
      )
    }

    // 页面尺寸与页边距跟随编辑器配置，保证分页与画布一致
    const { width, height, margins, paperDirection, pageNumber } = editorOptions
    const pageWidth = width || DEFAULT_PAGE_WIDTH
    const pageHeight = height || DEFAULT_PAGE_HEIGHT
    const pageMargin = margins || DEFAULT_PAGE_MARGIN
    const isHorizontal = paperDirection === PaperDirection.HORIZONTAL

    // 页眉页脚内容
    const headerChildren = await convertElementListToDocxChildren(header || [])
    const footerChildren = await convertElementListToDocxChildren(footer || [])
    // 编辑器页码渲染在页脚区域，导出时追加页码域（{pageNo}/{pageCount} 模板）
    if (pageNumber && !pageNumber.disabled) {
      const numberTextParts = (pageNumber.format || '{pageNo}')
        .split(/(\{pageNo\}|\{pageCount\})/)
        .filter(part => !!part)
      if (numberTextParts.length) {
        footerChildren.push(
          new Paragraph({
            alignment: getParagraphAlignment(pageNumber.rowFlex),
            children: [
              new TextRun({
                font: pageNumber.font,
                size: Math.round((pageNumber.size || 12) * 1.5),
                color: pageNumber.color
                  ? Color(pageNumber.color).hex()
                  : undefined,
                children: numberTextParts.map(part =>
                  part === '{pageNo}'
                    ? PageNumber.CURRENT
                    : part === '{pageCount}'
                      ? PageNumber.TOTAL_PAGES
                      : part
                )
              })
            ]
          })
        )
      }
    }
    // 中文页码 / 起始页码写入节属性
    const isChineseNumber = pageNumber?.numberType === NumberType.CHINESE
    const startPageNo = pageNumber?.startPageNo
    const pageNumbers =
      isChineseNumber || (startPageNo !== undefined && startPageNo !== 1)
        ? {
            formatType: isChineseNumber
              ? NumberFormat.CHINESE_COUNTING
              : undefined,
            start:
              startPageNo !== undefined && startPageNo !== 1
                ? startPageNo
                : undefined
          }
        : undefined

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: pxToTwip(isHorizontal ? pageHeight : pageWidth),
                height: pxToTwip(isHorizontal ? pageWidth : pageHeight),
                orientation: isHorizontal
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT
              },
              margin: {
                top: pxToTwip(pageMargin[0]),
                right: pxToTwip(pageMargin[1]),
                bottom: pxToTwip(pageMargin[2]),
                left: pxToTwip(pageMargin[3])
              },
              pageNumbers
            }
          },
          headers: {
            default: new Header({
              children: [
                ...buildWatermarkChildren(
                  (editorOptions as Record<string, any>).watermark || {},
                  pxToTwip(isHorizontal ? pageHeight : pageWidth) / 20,
                  pxToTwip(isHorizontal ? pageWidth : pageHeight) / 20
                ),
                ...headerChildren
              ] as (Paragraph | Table)[]
            })
          },
          footers: {
            default: new Footer({
              children: footerChildren
            })
          },
          children
        }
      ]
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${fileName}.docx`)
    return blob
  }
}
