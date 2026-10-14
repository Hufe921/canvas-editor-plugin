import type { Element, Node } from '@xmldom/xmldom'
import type { WordBorder, WordBorders, TablePresentation, CellPresentation } from './model'
const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
type Loss = (code: string, message: string) => void
const isElement = (node: Node): node is Element => node.nodeType === 1
function child(node: Element | undefined, name: string): Element | undefined {
  if (!node) return undefined
  for (const value of Array.from(node.childNodes)) if (isElement(value) && value.namespaceURI === w && value.localName === name) return value
  return undefined
}
const attribute = (node: Element | undefined, name = 'val') => node?.getAttributeNS(w, name) ?? undefined
export function readShading(node: Element | undefined, lose: Loss): string | undefined {
  if (!node) return undefined
  const fill = attribute(node, 'fill')
  if (attribute(node, 'themeFill') || !['clear', 'nil', undefined].includes(attribute(node)) || !fill || !/^[a-f0-9]{6}$/i.test(fill)) { lose('SOURCE_SHADING_UNSUPPORTED', 'Shading requires an explicit solid RGB fill without theme or pattern.'); return undefined }
  return '#' + fill.toLowerCase()
}
export function readBorders(node: Element | undefined, lose: Loss): WordBorders | undefined {
  if (!node) return undefined
  const result: WordBorders = {}
  const names: Array<keyof WordBorders> = ['top', 'right', 'bottom', 'left', 'insideHorizontal', 'insideVertical']
  for (const name of names) {
    const source = child(node, name === 'insideHorizontal' ? 'insideH' : name === 'insideVertical' ? 'insideV' : name)
    if (!source) continue
    const rawStyle = attribute(source); const style = rawStyle === 'nil' ? 'none' : rawStyle
    if (style === 'none') { result[name] = { style, color: '#000000', width: 0, space: 0 }; continue }
    const color = attribute(source, 'color') ?? '000000'; const width = Number(attribute(source, 'sz') ?? 0) / 8; const space = Number(attribute(source, 'space') ?? 0)
    if ((style !== 'none' && style !== 'single' && style !== 'double' && style !== 'dashed' && style !== 'dotted') || color !== 'auto' && !/^[a-f0-9]{6}$/i.test(color) || attribute(source, 'themeColor') || !Number.isFinite(width) || width < 0 || width > 12 || !Number.isFinite(space) || space < 0 || space > 31) { lose('SOURCE_BORDER_UNSUPPORTED', 'Border requires supported style, RGB/automatic color and bounded width/spacing.'); continue }
    result[name] = { style, color: color === 'auto' ? 'auto' : '#' + color.toLowerCase(), width, space }
  }
  for (const value of Array.from(node.childNodes)) if (value.nodeType === 1 && 'localName' in value && !['top', 'right', 'bottom', 'left', 'insideH', 'insideV'].includes(String(value.localName))) lose('SOURCE_BORDER_EDGE_UNSUPPORTED', 'Logical or between-paragraph borders require explicit conversion handling.')
  return result
}
function readMargins(node: Element | undefined, lose: Loss): [number, number, number, number] | undefined {
  if (!node) return undefined
  const values = ['top', 'right', 'bottom', 'left'].map(name => {
    const side = child(node, name); const value = Number(attribute(side, 'w') ?? 0) / 15
    if (!side) lose('SOURCE_PARTIAL_CELL_MARGIN', 'Partial cell margins require inheritance resolution before conversion.')
    if (side && attribute(side, 'type') !== 'dxa' || !Number.isFinite(value) || value < 0 || value > 8192) { lose('SOURCE_CELL_MARGIN_UNSUPPORTED', 'Cell margins require bounded twip distances.'); return 0 }
    return value
  })
  const [top = 0, right = 0, bottom = 0, left = 0] = values
  for (const name of ['start', 'end']) if (child(node, name)) lose('SOURCE_LOGICAL_CELL_MARGIN', 'Logical cell margins require explicit conversion handling.')
  return [top, right, bottom, left]
}
export function readTablePresentation(node: Element | undefined, lose: Loss): TablePresentation {
  const result: TablePresentation = {}
  const width = child(node, 'tblW'); if (width) {
    const type = attribute(width, 'type'); const source = attribute(width, 'w')
    const value = Number(source) / (type === 'pct' ? 50 : type === 'dxa' ? 15 : 1)
    if ((type === 'auto' || type === 'pct' || type === 'dxa') && source !== undefined && Number.isFinite(value) && value >= 0 && value <= (type === 'pct' ? 100 : 8192)) result.width = { type: type === 'pct' ? 'percent' : type === 'dxa' ? 'absolute' : 'auto', value }
    else lose('SOURCE_TABLE_WIDTH', 'Table width requires a bounded auto, percent or absolute value.')
  }
  const alignment = attribute(child(node, 'jc')); if (alignment === 'left' || alignment === 'center' || alignment === 'right') result.alignment = alignment
  else if (alignment) lose('SOURCE_TABLE_ALIGNMENT', 'Logical table alignment requires explicit conversion handling.')
  const layout = attribute(child(node, 'tblLayout'), 'type'); if (layout === 'fixed') result.layout = 'fixed'; else if (layout === 'autofit') result.layout = 'auto'; else if (layout) lose('SOURCE_TABLE_LAYOUT', 'Unknown table layout mode.')
  const indent = child(node, 'tblInd'); if (indent) { const value = Number(attribute(indent, 'w')) / 15; if (attribute(indent, 'type') === 'dxa' && Number.isFinite(value) && value >= 0 && value <= 8192) result.indent = value; else lose('SOURCE_TABLE_INDENT', 'Table indent requires bounded twip distance.') }
  const borders = readBorders(child(node, 'tblBorders'), lose); if (borders) result.borders = borders
  const shading = readShading(child(node, 'shd'), lose); if (shading) result.shading = shading
  const margins = readMargins(child(node, 'tblCellMar'), lose); if (margins) result.margins = margins
  return result
}
export function readCellPresentation(node: Element | undefined, lose: Loss): CellPresentation {
  const result: CellPresentation = {}
  const width = child(node, 'tcW'); if (width) {
    const type = attribute(width, 'type'); const source = attribute(width, 'w')
    const value = Number(source) / (type === 'pct' ? 50 : type === 'dxa' ? 15 : 1)
    if ((type === 'auto' || type === 'pct' || type === 'dxa') && source !== undefined && Number.isFinite(value) && value >= 0 && value <= (type === 'pct' ? 100 : 8192)) result.width = { type: type === 'pct' ? 'percent' : type === 'dxa' ? 'absolute' : 'auto', value }
    else lose('SOURCE_CELL_WIDTH', 'Preferred cell width requires a bounded auto, percent or absolute value.')
  }
  const borders = readBorders(child(node, 'tcBorders'), lose); if (borders) result.borders = borders
  const shading = readShading(child(node, 'shd'), lose); if (shading) result.shading = shading
  const margins = readMargins(child(node, 'tcMar'), lose); if (margins) result.margins = margins
  const alignment = attribute(child(node, 'vAlign')); if (alignment === 'top' || alignment === 'center' || alignment === 'bottom') result.verticalAlignment = alignment; else if (alignment) lose('SOURCE_CELL_ALIGNMENT', 'Cell vertical alignment is unsupported.')
  return result
}
export function bordersXml(borders: WordBorders, container: string): string {
  const edges: Array<keyof WordBorders> = ['top', 'left', 'bottom', 'right', 'insideHorizontal', 'insideVertical']
  return `<w:${container}>` + edges.map(edge => {
    const border: WordBorder | undefined = borders[edge]; if (!border) return ''
    const name = edge === 'insideHorizontal' ? 'insideH' : edge === 'insideVertical' ? 'insideV' : edge
    return border.style === 'none' ? `<w:${name} w:val="none"/>` : `<w:${name} w:val="${border.style}" w:color="${border.color==='auto'?'auto':border.color.slice(1)}" w:sz="${Math.round(border.width * 8)}" w:space="${border.space}"/>`
  }).join('') + `</w:${container}>`
}
export const shadingXml = (fill: string) => `<w:shd w:val="clear" w:color="auto" w:fill="${fill.slice(1)}"/>`
export function marginsXml(values: [number, number, number, number], container: string): string {
  return `<w:${container}>` + [0,3,2,1].map(index => `<w:${['top','right','bottom','left'][index]} w:w="${Math.round((values[index] ?? 0) * 15)}" w:type="dxa"/>`).join('') + `</w:${container}>`
}
