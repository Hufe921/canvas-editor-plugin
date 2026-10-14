import type { Element, Node } from '@xmldom/xmldom'
import type { TextStyle, ParagraphStyle } from './model'

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
type Loss = (code: string, message: string) => void
const quiet: Loss = () => undefined
const isElement = (node: Node): node is Element => node.nodeType === 1
const elements = (node: Node): Element[] => Array.from(node.childNodes).filter(isElement)
const child = (node: Node, name: string): Element | undefined => elements(node).find(element => element.namespaceURI === w && element.localName === name)
const val = (node: Element, name = 'val'): string | null => node.getAttributeNS(w, name)
function supportedAttributes(node: Element, names: readonly string[]): boolean {
  return Array.from(node.attributes).every(attribute => attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/' || attribute.namespaceURI === w && names.includes(attribute.localName ?? ''))
}
export function readTextTypography(node: Node | undefined, lose: Loss = quiet): TextStyle {
  const result: TextStyle = {}; if (!node) return result
  for (const [property, name] of [['smallCaps', 'smallCaps'], ['allCaps', 'caps']] as const) {
    const source = child(node, name); if (!source) continue
    const value = val(source)
    if (!supportedAttributes(source, ['val']) || value !== null && !['0', 'false', 'off', '1', 'true', 'on'].includes(value)) { lose('SOURCE_RUN_TOGGLE_UNSUPPORTED', `Unsupported ${name} attributes or toggle value remain only in the original.`); continue }
    result[property] = !['0', 'false', 'off'].includes(value ?? '')
  }
  const vertical = child(node, 'vertAlign')
  if (vertical) {
    const value = val(vertical)
    if (supportedAttributes(vertical, ['val']) && (value === 'baseline' || value === 'superscript' || value === 'subscript')) result.verticalAlignment = value
    else lose('SOURCE_RUN_VERTICAL_ALIGNMENT', 'Unknown vertical alignment or attributes remain only in the original; conversion does not claim baseline fidelity.')
  }
  return result
}
type Tab = NonNullable<ParagraphStyle['tabs']>[number]
function tabAlignment(value: string | null): Tab['alignment'] | undefined {
  switch (value) { case 'left': case 'center': case 'right': case 'decimal': case 'bar': case 'clear': case 'num': return value; default: return undefined }
}
function tabLeader(value: string | null): Tab['leader'] {
  switch (value) { case 'none': case 'dot': case 'hyphen': case 'underscore': case 'heavy': case 'middleDot': return value; default: return undefined }
}
export function readTabStops(properties: Node | undefined, lose: Loss = quiet): ParagraphStyle['tabs'] {
  if (!properties) return undefined
  const tabs = child(properties, 'tabs'); if (!tabs) return undefined
  const result: Tab[] = []; const positions = new Set<number>(); const entries = elements(tabs)
  if (!supportedAttributes(tabs, [])) lose('SOURCE_TAB_STOP_UNSUPPORTED', 'Tab collection attributes remain only in the original.')
  if (entries.length > 128) lose('SOURCE_TAB_STOP_LIMIT', 'Tab collections exceeding 128 stops require explicit conversion handling.')
  for (const entry of entries.slice(0, 128)) {
    const alignment = tabAlignment(val(entry)); const rawPosition = val(entry, 'pos'); const rawLeader = val(entry, 'leader'); const leader = tabLeader(rawLeader)
    const position = rawPosition !== null && /^-?\d+$/u.test(rawPosition) ? Number(rawPosition) / 15 : NaN
    if (entry.namespaceURI !== w || entry.localName !== 'tab' || !supportedAttributes(entry, ['val', 'pos', 'leader']) || !alignment || !Number.isFinite(position) || Math.abs(position) > 8192 || rawLeader !== null && leader === undefined) { lose('SOURCE_TAB_STOP_UNSUPPORTED', 'Unsupported tab alignment, leader, attributes or position remain only in the original.'); continue }
    if (positions.has(position)) { lose('SOURCE_TAB_STOP_DUPLICATE', 'Conflicting stops at one position require explicit conversion handling.'); continue }
    positions.add(position); result.push({alignment,position,...(leader === undefined ? {} : {leader})})
  }
  return result
}

/** Audit original property nodes once, including defaults, named styles, stories
 * and before snapshots. Parsing styles repeatedly must not inflate loss counts. */
export function auditWordProperties(part: Node, lose: Loss, alreadyReported: ReadonlySet<string>): void {
  const supportedRuns = new Set(['rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'color', 'spacing', 'sz', 'szCs', 'highlight', 'u', 'shd', 'vertAlign', 'rPrChange'])
  const supportedParagraphs = new Set(['pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'widowControl', 'numPr', 'pBdr', 'shd', 'tabs', 'spacing', 'ind', 'jc', 'outlineLvl', 'rPr', 'sectPr', 'pPrChange'])
  const visit = (node: Node): void => {
    if (isElement(node) && node.namespaceURI === w && (node.localName === 'rPr' || node.localName === 'pPr')) {
      const run = node.localName === 'rPr'; const supported = run ? supportedRuns : supportedParagraphs; const seen = new Set<string>()
      for (const property of elements(node)) {
        const name = property.localName ?? property.nodeName
        const paragraphMark = node.parentNode?.namespaceURI === w && node.parentNode.localName === 'pPr' && property.namespaceURI === w && ['ins', 'del'].includes(name)
        if (property.namespaceURI !== w || !supported.has(name) && !alreadyReported.has(name) && !paragraphMark) lose(run ? 'SOURCE_RUN_PROPERTY_UNSUPPORTED' : 'SOURCE_PARAGRAPH_PROPERTY_UNSUPPORTED', `Unsupported ${run ? 'run' : 'paragraph'} property ${name} remains only in the original.`)
        if (seen.has(name)) lose('SOURCE_PROPERTY_DUPLICATE', 'Repeated run/paragraph properties require explicit conversion handling.'); seen.add(name)
      }
      if (run) readTextTypography(node, lose); else readTabStops(node, lose)
    }
    for (const element of elements(node)) visit(element)
  }
  visit(part)
}
