import {documentTheme} from './theme'
import { auditWordProperties, readTextTypography, readTabStops } from './typography'
import { readEmbeddedFonts, type WordEmbeddedFont } from './fonts'
import { readBorders, readShading, readTablePresentation, readCellPresentation } from './appearance'
import { validateStyles,importedStyleId,type WordStyleDefinitions } from './styles'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { Element, Node } from '@xmldom/xmldom'
import { validateDocxPackage, parseDocumentXml } from './packageValidation'
import {
  type WordDocument,
  type DocumentParagraph,
  type DocumentRun,
  type DocumentLayout,
  type TextStyle,
  type ParagraphStyle,
  type DocumentBlock,
  defaultLayout,
  paragraphsOf,
  allBlocks,
  cellBlocks,
} from './model'
import { validateDocument } from './validation'
import { WordCodecError } from './errors'
import { bytesSha256 } from './hash'
const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const pr = 'http://schemas.openxmlformats.org/package/2006/relationships'
const direct = (node: Node, name: string): Element[] =>
  Array.from(node.childNodes).filter(
    (child) =>
      child.nodeType === 1 &&
      (child as Element).namespaceURI === w &&
      (child as Element).localName === name,
  ) as Element[]
const child = (node: Node, name: string) => direct(node, name)[0]
const val = (element: Element | undefined, name = 'val') =>
  element?.getAttributeNS(w, name) ?? null
const number = (value: string | null, fallback = 0) =>
  value !== null && Number.isFinite(Number(value)) ? Number(value) : fallback
const enabled = (node: Node, name: string) => {
  const value = child(node, name)
  return value ? !['0', 'false', 'off'].includes(val(value) ?? '') : undefined
}
export interface DocxIncomingAsset {
  placeholderId: number;
  sha256: string;
  mediaType: 'image/png' | 'image/jpeg';
  bytesBase64: string;
  width: number;
  height: number;
}
export interface DocxSection { start: number; end: number; breakAfter?: 'continuous' | 'nextPage'; document: WordDocument; stories?: {header?:WordDocument;footer?:WordDocument} }
export interface DocxConversion { document:WordDocument; sections: DocxSection[]; styleDefinitions:WordStyleDefinitions; fonts:WordEmbeddedFont[]; assets:DocxIncomingAsset[]; losses:Array<{code:string;count:number;message:string}>; detected:Array<{feature:string;count:number}> }
/** Authoritative bounded conversion reads only validated local package parts.
 * No browser ZIP loader, network fetch, scripts, fields or external images run. */
export async function importDocx(bytes: Buffer): Promise<DocxConversion> {
  const files = await validateDocxPackage(bytes)
  const fonts = readEmbeddedFonts(files)
  const xml = parseDocumentXml(files.get('word/document.xml')!)
  const body = xml.getElementsByTagNameNS(w, 'body').item(0)
  if (!body)
    throw new WordCodecError('DOCUMENT_IMPORT_INVALID', 'DOCX document body is missing.', 422)
  const losses = new Map<string, { code: string; count: number; message: string }>()
  const lose = (code: string, message: string, count = 1) => {
    const prior = losses.get(code)
    losses.set(code, { code, count: (prior?.count ?? 0) + count, message })
  }
  const detected: Array<{ feature: string; count: number }> = []
  const unsupported: Record<string, string> = {
    bidi: 'Paragraph bidirectional layout is not represented; exact Unicode text remains preserved in the conversion and original.',
    rtl: 'Run bidirectional layout is not represented; exact Unicode text remains preserved in the conversion and original.',
    textDirection: 'Vertical or alternate text flow is retained only in the original.',
    framePr: 'Positioned paragraph frames are retained only in the original.',
    titlePg: 'Different first-page headers and footers are retained only in the original.',
    evenAndOddHeaders: 'Separate odd/even header and footer behavior is retained only in the original.',
    tblStyle: 'Table-style borders, shading and conditional inheritance remain only in the original; supported table cells, direct text properties and widths are retained.',
    moveFrom: 'Moved-content revisions are not converted as insert/delete changes.',
    moveTo: 'Moved-content revisions are not converted as insert/delete changes.',
    tblPrChange: 'Table structure/property revisions are not supported.',
    trPrChange: 'Table row revisions are not supported.',
    tcPrChange: 'Table cell revisions are not supported.',
    tblGridChange: 'Table grid revisions are not supported.',
    footnoteReference: 'Footnotes are retained only in the original.',
    endnoteReference: 'Endnotes are retained only in the original.',
    fldSimple: 'Advanced fields are imported as displayed text.',
    sdt: 'Content control behavior is retained only in the original.',
    object: 'Embedded objects are retained only in the preserved original.',
    pict: 'Legacy VML drawings are retained only in the preserved original.',
    altChunk: 'Embedded alternative-content parts cannot be safely converted.',
  }
  if (fonts.length) detected.push({feature:'embeddedFontsRequireApproval',count:fonts.length})
  const unsupportedCounts=new Map<string,number>()
  // Do not turn a tolerated source-package defect into a claim of OOXML fidelity.
  const paragraphOrder = ['pStyle','keepNext','keepLines','pageBreakBefore','framePr','widowControl','numPr','suppressLineNumbers','pBdr','shd','tabs','suppressAutoHyphens','kinsoku','wordWrap','overflowPunct','topLinePunct','autoSpaceDE','autoSpaceDN','bidi','adjustRightInd','snapToGrid','spacing','ind','contextualSpacing','mirrorIndents','suppressOverlap','jc','textDirection','textAlignment','textboxTightWrap','outlineLvl','divId','cnfStyle','rPr','sectPr','pPrChange']
  for (const [name, content] of files) if (name.startsWith('word/') && name.endsWith('.xml')) {
    const part = parseDocumentXml(content)
    auditWordProperties(part, lose, new Set(Object.keys(unsupported)))
    for (const stop of Array.from(part.getElementsByTagNameNS(w, 'defaultTabStop'))) if (val(stop) !== '720') lose('SOURCE_DEFAULT_TAB_STOP', 'Custom document-wide default tab intervals are not represented; exact spacing remains only in the original.')
    for (const level of Array.from(part.getElementsByTagNameNS(w, 'lvl'))) {
      const properties = child(level, 'pPr'); const tabs = properties ? child(properties, 'tabs') : undefined
      if (tabs && (direct(tabs, 'tab').length !== 1 || direct(tabs, 'tab').some(stop => val(stop) !== 'num' || val(stop, 'pos') !== '720' || val(stop, 'leader') !== null && val(stop, 'leader') !== 'none'))) lose('SOURCE_NUMBERING_TABS', 'Custom numbering-level tab stops are not retained by flat list conversion; source numbering remains in the original.')
    }
    for(const name of Object.keys(unsupported)){const count=Array.from(part.getElementsByTagNameNS(w,name)).filter(element=>!['bidi','rtl','titlePg','evenAndOddHeaders'].includes(name)||!['0','false','off'].includes(val(element)??'')).length;if(count)unsupportedCounts.set(name,(unsupportedCounts.get(name)??0)+count)}
    for (const properties of Array.from(part.getElementsByTagNameNS(w, 'trPr'))) if (child(properties, 'trHeight')) lose('SOURCE_ROW_HEIGHT', 'Fixed or minimum row height requires explicit conversion handling.')
    for (const columns of Array.from(part.getElementsByTagNameNS(w,'cols'))) if (direct(columns,'col').length || columns.getAttributeNS(w,'equalWidth') === '0') lose('UNEQUAL_COLUMN_LAYOUT','Unequal column widths require explicit redesign; equal-width print columns are preserved.')
    for (const kind of ['header','footer']) for (const reference of Array.from(part.getElementsByTagNameNS(w,kind+'Reference'))) if (reference.getAttributeNS(w,'type') && reference.getAttributeNS(w,'type')!=='default') lose('CONDITIONAL_STORY_REFERENCE','First/even-page story variants are retained only in the original; the default story is selected where available.')
    for(const kind of ['ins','del','rPrChange','pPrChange','comment']) for(const review of Array.from(part.getElementsByTagNameNS(w,kind))){const rawDate=review.getAttributeNS(w,'date');if(!rawDate||!Number.isFinite(Date.parse(rawDate)))lose('REVIEW_DATE_UNKNOWN','Missing or invalid imported review timestamps use an explicit epoch sentinel; the original remains retained and the actual timestamp is unknown.')}
    for (const properties of Array.from(part.getElementsByTagNameNS(w, 'pPr'))) {
      let previous = -1; let invalid = false
      for (const node of Array.from(properties.childNodes)) if (node.nodeType === 1 && (node as Element).namespaceURI === w) {
        const rank = paragraphOrder.indexOf((node as Element).localName!); if (rank < 0) continue
        if (rank < previous) invalid = true; previous = rank
      }
      if (invalid) lose('SOURCE_OOXML_PROPERTY_ORDER', 'Source paragraph property ordering is not schema-valid; supported values are converted, original XML is retained, and Exported DOCX is rebuilt in canonical order.')
    }
    for (const run of Array.from(part.getElementsByTagNameNS(w, 'r'))) if (direct(run, 'rPr').length > 1 || direct(run, 'rPrChange').length) throw new WordCodecError('DOCUMENT_IMPORT_RUN_PROPERTIES_AMBIGUOUS', 'Source run has duplicate property sets or a misplaced formatting revision. Its exact current/original review state cannot be safely determined; preserve the original and repair it in its source application.', 422)
    for (const kind of ['rPrChange', 'pPrChange']) {
      const seen = new Set<string>()
      for (const revision of Array.from(part.getElementsByTagNameNS(w, kind))) {
        const properties = kind === 'rPrChange' ? 'rPr' : 'pPr'
        if (direct(revision, properties).length !== 1 || revision.parentNode?.namespaceURI !== w || revision.parentNode.localName !== properties) throw new WordCodecError('DOCUMENT_IMPORT_REVIEW_SNAPSHOT_INCOMPLETE', 'Formatting revisions require exactly one explicit previous property snapshot in the matching current property container.', 422)
        const id = revision.getAttributeNS(w, 'id')
        if (!id || seen.has(id)) lose('SOURCE_REVISION_IDENTIFIER', 'Source property-revision identifiers are missing or duplicated within a Word part. Distinct converted records receive new canonical identities; original identifiers remain preserved and are not claimed to survive exactly.')
        if (id) seen.add(id)
      }
    }
    for (const charset of Array.from(part.getElementsByTagNameNS(w, 'charset'))) if (charset.hasAttributeNS(w, 'characterSet')) lose('SOURCE_FONT_CHARSET_ATTRIBUTE', 'Source font charset metadata is not represented by the Unicode canonical model; the original attribute remains preserved.')
    for (const alignment of Array.from(part.getElementsByTagNameNS(w, 'lvlJc'))) if (['start','end'].includes(val(alignment) ?? '')) lose('SOURCE_LIST_LEVEL_ALIGNMENT', 'Source logical list-level alignment is not retained as a separate numbering definition; original numbering XML remains preserved.')
  }

  for (const [name, message] of Object.entries(unsupported)) {
    const count = unsupportedCounts.get(name)??0
    if (count) {
      lose(name, message, count)
      detected.push({ feature: name, count })
      if (name === 'altChunk')
        throw new WordCodecError(
          'DOCUMENT_IMPORT_UNSAFE_CONVERSION',
          'Embedded alternative content requires an independent conversion. Original is retained.',
          422,
        )
    }
  }
  if (Array.from(files.keys()).some((name) => /vbaProject|activeX|embeddings\//i.test(name)))
    lose(
      'ACTIVE_OR_EMBEDDED_PARTS',
      'Macros, active controls and embedded packages are not executed or converted; exact original bytes remain preserved.',
    )
  if (files.has('word/commentsExtended.xml') || files.has('word/commentsIds.xml'))
    lose(
      'THREADED_COMMENTS',
      'Modern threaded comment relationships and replies are retained in the original.',
    )
  const theme=documentTheme(files,lose)
  let defaultParagraphId='Normal'
  const styles = new Map<string, { paragraph: ParagraphStyle; run: TextStyle }>()
  const styleAliases=new Map<string,string>();const styleDefinitions:WordStyleDefinitions={}
  const readRunStyle = (node: Node | undefined,resolveReferences=true): TextStyle => {
    if (!node) return {}
    const character=val(child(node,'rStyle'))
    const style: TextStyle = {...(resolveReferences&&character?styles.get(character)?.run:{}),...(character?{characterStyleId:character}: {})}
    Object.assign(style, readTextTypography(node))
    const fonts=child(node,'rFonts');const font=fonts?.getAttributeNS(w,'ascii')??fonts?.getAttributeNS(w,'hAnsi');const themeFont=fonts?.getAttributeNS(w,'asciiTheme')??fonts?.getAttributeNS(w,'hAnsiTheme')
    if(font)style.font=font;if(themeFont){const resolved=theme.font(themeFont);if(resolved){if(font&&font!==resolved)lose('FONT_THEME_CONFLICT','Source run assigns differing explicit and theme fonts in one property set. Conversion retains the resolved primary theme snapshot; source font association/precedence differences remain in the original and exact cross-application typography is not claimed.');style.font=resolved}}
    if(fonts&&(fonts.getAttributeNS(w,'eastAsiaTheme')||fonts.getAttributeNS(w,'cstheme')||fonts.getAttributeNS(w,'eastAsia')&&fonts.getAttributeNS(w,'eastAsia')!==font||fonts.getAttributeNS(w,'cs')&&fonts.getAttributeNS(w,'cs')!==font||fonts.getAttributeNS(w,'hAnsiTheme')&&themeFont?.replace(/(?:Ascii|HAnsi)$/,'Latin')!==fonts.getAttributeNS(w,'hAnsiTheme')?.replace(/(?:Ascii|HAnsi)$/,'Latin')||fonts.getAttributeNS(w,'hAnsi')&&font!==fonts.getAttributeNS(w,'hAnsi')))lose('MULTISCRIPT_FONT_MAPPING','Separate Latin, East Asian and complex-script font slots are not represented independently; the resolved primary Latin font is retained.')
    const size = val(child(node, 'sz'))
    if (size) style.size = number(size) / 1.5
    const spacing = val(child(node, 'spacing'))
    if (spacing !== undefined && spacing !== null) style.characterSpacing = number(spacing) / 15
    for (const key of ['bold', 'italic', 'strikeout'] as const) {
      const value = enabled(node, key === 'bold' ? 'b' : key === 'italic' ? 'i' : 'strike')
      if (value !== undefined) style[key] = value
    }
    const underline = child(node, 'u')
    if (underline) style.underline = !['none', '0'].includes(val(underline) ?? 'single')
    const color = val(child(node, 'color'))
    if (color && /^[0-9a-f]{6}$/i.test(color)) style.color = `#${color}`
    const colorNode=child(node,'color');const themeColor=colorNode?.getAttributeNS(w,'themeColor');if(themeColor){const resolved=theme.color(themeColor,colorNode?.getAttributeNS(w,'themeTint'),colorNode?.getAttributeNS(w,'themeShade'),color);if(resolved)style.color=resolved}
    const fill = val(child(node, 'shd'), 'fill')
    if (fill && /^[0-9a-f]{6}$/i.test(fill)) style.highlight = `#${fill}`
    const shading=child(node,'shd');const themeFill=shading?.getAttributeNS(w,'themeFill');if(themeFill){const resolved=theme.color(themeFill,shading?.getAttributeNS(w,'themeFillTint'),shading?.getAttributeNS(w,'themeFillShade'),fill);if(resolved)style.highlight=resolved}
    const highlights: Record<string, string> = {
      yellow: '#ffff00',
      green: '#00ff00',
      cyan: '#00ffff',
      magenta: '#ff00ff',
      blue: '#0000ff',
      red: '#ff0000',
      darkBlue: '#000080',
      darkCyan: '#008080',
      darkGreen: '#008000',
      darkMagenta: '#800080',
      darkRed: '#800000',
      darkYellow: '#808000',
      darkGray: '#808080',
      lightGray: '#c0c0c0',
      black: '#000000',
      white: '#ffffff',
    }
    const highlight = val(child(node, 'highlight'))
    if (highlight && highlights[highlight]) style.highlight = highlights[highlight]
    return style
  }
  const numbering = new Map<string, 'bullet' | 'number'>()
  const numberingPart = files.get('word/numbering.xml')
  if (numberingPart) {
    const root = parseDocumentXml(numberingPart)
    const abstracts = new Map<string, 'bullet' | 'number'>()
    for (const element of Array.from(root.getElementsByTagNameNS(w, 'abstractNum')))
      abstracts.set(
        element.getAttributeNS(w, 'abstractNumId')!,
        val(element.getElementsByTagNameNS(w, 'numFmt').item(0) ?? undefined) === 'bullet'
          ? 'bullet'
          : 'number',
      )
    for (const element of Array.from(root.getElementsByTagNameNS(w, 'num')))
      numbering.set(
        element.getAttributeNS(w, 'numId')!,
        abstracts.get(val(child(element, 'abstractNumId'))!) ?? 'number',
      )
  }
  const readParagraphStyle = (node: Node | undefined): ParagraphStyle => {
    if (!node) return {}
    const style: ParagraphStyle = {}
    const id = val(child(node, 'pStyle'))
    if (id) {
      const inherited = styles.get(id)
      if (inherited && !styleAliases.has(id)) Object.assign(style, inherited.paragraph)
      if(styleAliases.has(id))style.name=styleAliases.get(id)
      const heading = /Heading([1-6])$/i.exec(id)
      if (heading) style.heading = Number(heading[1]) as ParagraphStyle['heading']
      else if (id !== 'Normal' && !styles.has(id))
        lose('CUSTOM_STYLE', `Undefined style ${id} uses resolved direct formatting.`)
    }
    const outline=val(child(node,'outlineLvl'));if(outline!==null&&Number(outline)>=0&&Number(outline)<6)style.heading=(Number(outline)+1) as ParagraphStyle['heading']
    const tabs = readTabStops(node); if (tabs !== undefined) style.tabs = tabs
    const alignment = val(child(node, 'jc'))
    if (alignment && ['left', 'center', 'right', 'both', 'start', 'end'].includes(alignment))
      style.alignment =
        alignment === 'both' ? 'justify' : alignment === 'start' ? 'left' : alignment === 'end' ? 'right' : (alignment as ParagraphStyle['alignment'])
    const spacing = child(node, 'spacing')
    if (spacing) {
      const line = val(spacing, 'line')
      if (line) {
        const rule = val(spacing, 'lineRule') ?? 'auto'
        if (rule === 'auto') { style.lineRule = 'auto'; style.lineSpacing = number(line) / 240 }
        else if (rule === 'exact' || rule === 'atLeast') { style.lineRule = rule; style.lineSpacing = number(line) / 15 }
        else lose('SOURCE_LINE_RULE', 'Unknown line-height rule requires explicit conversion handling.')
      }
      for (const key of ['before', 'after'] as const) {
        const value = val(spacing, key)
        if (value !== null) style[key] = number(value) / 15
      }
    }
    const indent = child(node, 'ind')
    if (indent) {
      const left = val(indent, 'left') ?? val(indent, 'start')
      if (left !== null) style.indent = number(left) / 15
      const right = val(indent, 'right') ?? val(indent, 'end'); if (right !== null) style.rightIndent = number(right) / 15
      const first = val(indent, 'firstLine')
      const hanging = val(indent, 'hanging')
      if (first !== null || hanging !== null)
        style.firstLineIndent = (hanging !== null ? -number(hanging) : number(first)) / 15
    }
    for (const key of ['keepWithNext', 'pageBreakBefore'] as const) {
      const value = enabled(node, key === 'keepWithNext' ? 'keepNext' : key)
      if (value !== undefined) style[key] = value
    }
    for (const [key, name] of [['keepTogether', 'keepLines'], ['widowControl', 'widowControl']] as const) { const value = enabled(node, name); if (value !== undefined) style[key] = value }
    const borders = readBorders(child(node, 'pBdr'), lose); if (borders) style.borders = borders
    const shading = readShading(child(node, 'shd'), lose); if (shading) style.shading = shading
    const num = child(node, 'numPr')
    if (num) {
      const id = val(child(num, 'numId'))
      if (id && id !== '0') style.list = numbering.get(id) ?? 'number'
      const level = number(val(child(num, 'ilvl')))
      if (level > 0) lose('MULTILEVEL_LIST', 'Nested list levels use a flat supported list.')
    }
    return style
  }
  let defaultRunStyle: TextStyle = {}
  let defaultParagraphStyle: ParagraphStyle = {}
  const stylesPart = files.get('word/styles.xml')
  if (stylesPart) {
    const root=parseDocumentXml(stylesPart);const defaults=root.getElementsByTagNameNS(w,'docDefaults').item(0);const defaultRun=defaults?readRunStyle(child(child(defaults,'rPrDefault')??defaults,'rPr')):{};const defaultParagraph=defaults?readParagraphStyle(child(child(defaults,'pPrDefault')??defaults,'pPr')):{};defaultRunStyle=defaultRun;defaultParagraphStyle=defaultParagraph;styles.set('Normal',{run:defaultRun,paragraph:defaultParagraph})
    for (const element of Array.from(
      root.getElementsByTagNameNS(w, 'style'),
    )) {
      const id = element.getAttributeNS(w, 'styleId')!
      if(element.getAttributeNS(w,'type')==='paragraph'&&['1','true','on'].includes(element.getAttributeNS(w,'default')??''))defaultParagraphId=id
      styles.set(id, {
        paragraph: {...defaultParagraph,...readParagraphStyle(child(element, 'pPr'))},
        run: {...defaultRun,...readRunStyle(child(element, 'rPr'))},
      })
    }
  }
  if (stylesPart) {
    const nodes = new Map(
      Array.from(parseDocumentXml(stylesPart).getElementsByTagNameNS(w, 'style')).map((node) => [
        node.getAttributeNS(w, 'styleId')!,
        node,
      ]),
    )
    const resolved = new Set<string>()
    const resolve = (id: string, path: Set<string>) => {
      if (resolved.has(id)) return
      if (path.has(id) || path.size > 50)
        throw new WordCodecError(
          'DOCUMENT_IMPORT_STYLE_INVALID',
          'Named style inheritance is cyclic or too deep.',
          422,
        )
      const node = nodes.get(id)
      const own = styles.get(id)
      if (!node || !own) return
      const parent = val(child(node, 'basedOn'))
      if (parent && styles.has(parent)) {
        resolve(parent, new Set([...path, id]))
        const inherited = styles.get(parent)!
        styles.set(id, {
          paragraph: { ...inherited.paragraph, ...own.paragraph },
          run: { ...inherited.run, ...own.run },
        })
      }
      resolved.add(id)
    }
    for (const id of nodes.keys()) resolve(id, new Set())
  }
  if (stylesPart && !styles.has('DefaultParagraphFont') && ['basedOn','rStyle'].some(name=>Array.from(parseDocumentXml(stylesPart).getElementsByTagNameNS(w,name)).some(node=>val(node)==='DefaultParagraphFont'))) { const definition = {kind:'character' as const,paragraph:{},run:defaultRunStyle,label:'Default Paragraph Font'}; const id=importedStyleId(definition); styleAliases.set('DefaultParagraphFont',id);styleDefinitions[id]=definition }
  if(stylesPart)for(const node of Array.from(parseDocumentXml(stylesPart).getElementsByTagNameNS(w,'style'))){
    const rawId=node.getAttributeNS(w,'styleId')!;if(!['paragraph','character'].includes(node.getAttributeNS(w,'type')??''))continue
    const kind=(node.getAttributeNS(w,'type')??'paragraph') as 'paragraph'|'character';const parent=val(child(node,'basedOn'));const label=val(child(node,'name'))??rawId
    const run={...readRunStyle(child(node,'rPr'),false)}
    const definition={kind,paragraph:kind==='character'?{}:{...readParagraphStyle(child(node,'pPr')),name:undefined},run,label,...(parent?{basedOn:parent}:{})};const id=importedStyleId(definition);styleAliases.set(rawId,id);styleDefinitions[id]={...definition,paragraph:{...definition.paragraph,...(kind==='paragraph'?{name:id}:{})}}
  }
  for(const definition of Object.values(styleDefinitions))if(definition.run.characterStyleId){const id=styleAliases.get(definition.run.characterStyleId);if(id)definition.run.characterStyleId=id;else{delete definition.run.characterStyleId;lose('UNDEFINED_CHARACTER_STYLE','Unknown character style references retain only available direct properties.')}}
  for(const definition of Object.values(styleDefinitions))if(definition.basedOn){const id=styleAliases.get(definition.basedOn);if(id)definition.basedOn=id;else{delete definition.basedOn;lose('UNDEFINED_STYLE_PARENT','Undefined named style parents cannot be preserved; available resolved properties remain.') }}
  validateStyles(styleDefinitions)
  const assets: DocxIncomingAsset[] = []
  let compatibilityMode: WordDocument['compatibilityMode']
  const settings = files.get('word/settings.xml')
  if (settings) {
    const root = parseDocumentXml(settings)
    for (const element of Array.from(root.getElementsByTagNameNS(w,'compatSetting'))) {
      if (element.getAttributeNS(w,'name') !== 'compatibilityMode') { lose('WORD_COMPATIBILITY_UNSUPPORTED','Additional Word compatibility settings require explicit layout handling.'); continue }
      const value = Number(element.getAttributeNS(w,'val'))
      if (value === 11 || value === 12 || value === 14 || value === 15) compatibilityMode = value
      else lose('WORD_COMPATIBILITY_UNSUPPORTED','Unknown Word compatibility mode requires explicit layout handling.')
    }
    for (const compat of Array.from(root.getElementsByTagNameNS(w,'compat'))) for (const element of Array.from(compat.childNodes)) if (element.nodeType === 1 && 'localName' in element && element.localName !== 'compatSetting') lose('WORD_COMPATIBILITY_UNSUPPORTED','Legacy Word compatibility switches require explicit layout handling.')
  }
    const makeDocument = () =>
    ({
      schemaVersion: 1 as const,
      defaults: { paragraph: structuredClone(defaultParagraphStyle), run: structuredClone(defaultRunStyle) },
      ...(compatibilityMode === undefined ? {} : {compatibilityMode}),
      blocks: [] as DocumentBlock[],
      changes: [],
      comments: [],
      layout: defaultLayout(),
    }) as WordDocument
  const document = makeDocument()
  const relationships = (part: string) => {
    const map = new Map<string, { target: string; type: string; external: boolean }>()
    const relPath = path.posix.join(
      path.posix.dirname(part),
      '_rels',
      path.posix.basename(part) + '.rels',
    )
    const bytes = files.get(relPath)
    if (bytes)
      for (const element of Array.from(
        parseDocumentXml(bytes).getElementsByTagNameNS(pr, 'Relationship'),
      )) {
        const target = element.getAttribute('Target')!
        map.set(element.getAttribute('Id')!, {
          target:
            element.getAttribute('TargetMode') === 'External'
              ? target
              : path.posix.normalize(
                  target.startsWith('/')
                    ? target.slice(1)
                    : path.posix.join(path.posix.dirname(part), target),
                ),
          type: element.getAttribute('Type')!,
          external: element.getAttribute('TargetMode') === 'External',
        })
      }
    return map
  }
  const boundaryMarkers=new Map<string,{element:Element;kind:'paragraphSplit'|'paragraphJoin'}>()
  const commentAnchors = new Map<
    string,
    Array<{ blockId: string; runId: string; start: number; end: number; sourceText: string }>
  >()
  const activeComments = new Set<string>()
  const mappedPageParts = new Set<string>()
  const footerParts = new Set<string>()
  const paragraph = (element: Element, part = 'word/document.xml'): DocumentParagraph => {
    const style = readParagraphStyle(child(element, 'pPr'));const defaultStyle=styles.get(defaultParagraphId);if(!val(child(child(element,'pPr')??element,'pStyle'))){if(styleAliases.has(defaultParagraphId))style.name=styleAliases.get(defaultParagraphId);else Object.assign(style,{...defaultStyle?.paragraph,...style})}
    const block: DocumentParagraph = { type: 'paragraph', id: randomUUID(), style, runs: [] }
    const styleId = val(child(child(element, 'pPr') ?? element, 'pStyle'))??defaultParagraphId
    const inherited = styleId ? (styles.get(styleId)?.run ?? {}) : {}
    const relations = relationships(part)
    const pointStarts = new Map<string, { count: number; previous?: DocumentRun }>()
    const pendingPoints: string[] = []
    const pageResults = new Set<Element>()
    const pageFieldRuns = new Set<Element>()
    const fields: Array<{ instruction: string; result: boolean; page: boolean; start: Element }> = []
    for (const run of Array.from(element.getElementsByTagNameNS(w, 'r'))) for (const childNode of Array.from(run.childNodes)) {
      if (childNode.nodeType !== 1) continue
      const childElement = childNode as Element
      if (childElement.namespaceURI !== w) continue
      const field = fields.at(-1)
      if (childElement.localName === 'fldChar') {
        const kind = childElement.getAttributeNS(w, 'fldCharType')
        if (kind === 'begin') fields.push({ instruction: '', result: false, page: false, start: run })
        else if (kind === 'separate' && field) {
          field.result = true; field.page = /^\s*PAGE\s*$/i.test(field.instruction)
          if (field.page) { pageFieldRuns.add(field.start); mappedPageParts.add(part) }
        } else if (kind === 'end') {
          if (field && !field.result && /^\s*PAGE\s*$/i.test(field.instruction)) {
            pageFieldRuns.add(field.start); mappedPageParts.add(part)
          }
          fields.pop()
        }
      } else if (childElement.localName === 'instrText' && field) field.instruction += childElement.textContent ?? ''
      else if (['t', 'delText'].includes(childElement.localName!) && field?.result && field.page) pageResults.add(childElement)
    }

    const visit = (node: Node, revision?: Element, hyperlink?: string) => {
      for (const current of Array.from(node.childNodes)) {
        if (current.nodeType !== 1) continue
        const element = current as Element
        const name = element.localName
        if (element.namespaceURI === w && name === 'commentRangeStart') {
          const id = element.getAttributeNS(w, 'id')!; activeComments.add(id); pointStarts.set(id, { count: commentAnchors.get(id)?.length ?? 0, previous: block.runs.at(-1) })
          continue
        }
        if (element.namespaceURI === w && name === 'commentRangeEnd') {
          const id = element.getAttributeNS(w, 'id')!; activeComments.delete(id); const point = pointStarts.get(id); if (point && (commentAnchors.get(id)?.length ?? 0) === point.count) { if (point.previous) { const offset = point.previous.text.length; commentAnchors.set(id, [...(commentAnchors.get(id) ?? []), { blockId: block.id, runId: point.previous.id, start: offset, end: offset, sourceText: '' }]) } else pendingPoints.push(id) } pointStarts.delete(id)
          continue
        }
        if (element.namespaceURI === w && ['ins', 'del'].includes(name!)) {
          visit(element, element, hyperlink)
          continue
        }
        if (element.namespaceURI === w && name === 'hyperlink') {
          const relation = relations.get(element.getAttributeNS(r, 'id')!)
          visit(
            element,
            revision,
            relation?.external && /^https?:\/\//i.test(relation.target)
              ? relation.target
              : undefined,
          )
          continue
        }
        if (element.namespaceURI === w && name === 'r') {
          const properties = child(element, 'rPr')
          let text = ''; const segments: Array<{text: string; field?: 'pageNumber'; inlineImage?: Omit<Extract<DocumentBlock,{type:'image'}>,'type'|'id'>}> = []
          const flushText = () => { if(text) segments.push({text}); text='' }
          if (pageFieldRuns.has(element)) segments.push({text:'',field:'pageNumber'})
          for (const value of Array.from(element.childNodes)) {
            if (value.nodeType !== 1) continue
            const item = value as Element
            if (item.namespaceURI !== w) continue
            if (['t', 'delText'].includes(item.localName!)) {
              if (pageResults.has(item) && activeComments.size) throw new WordCodecError('DOCUMENT_IMPORT_COMMENT_FIELD_UNSUPPORTED', 'A comment targets a dynamic PAGE result that cannot be represented by an exact canonical text anchor. Preserve the original; no guessed range is attached.', 422)
              if (!pageResults.has(item)) text += item.textContent ?? ''
            }
            else if (item.localName === 'tab') text += '\t'
            else if (item.localName === 'br' || item.localName === 'cr') {
              if (item.getAttributeNS(w, 'type') === 'page')
                lose('INLINE_PAGE_BREAK', 'Inline page breaks become paragraph line breaks.')
              text += '\n'
            } else if (item.localName === 'drawing') {
              flushText(); if(item.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing','anchor').length) lose('FLOATING_DRAWING','Floating drawings become inline images.'); const value=image(item,part); if(value) {const inlineImage = { assetId: value.assetId, sha256: value.sha256, alt: value.alt, width: value.width, height: value.height };segments.push({text:'',inlineImage})}
            } else if (item.localName === 'instrText' && !/^\s*PAGE\s*$/i.test(item.textContent ?? ''))
              lose(
                'FIELD_INSTRUCTION',
                'Field instructions are not executed; stored display text is retained.',
              )
          }
          flushText()
          if(!segments.length&&[...direct(element,'t'),...direct(element,'delText')].some((item)=>!pageResults.has(item)))segments.push({text:''})
          for (const segment of segments) {
          const run: DocumentRun = {
            id: randomUUID(),
            text: segment.text,
            ...(segment.field ? {field:segment.field} : {}),
            ...(segment.inlineImage ? {inlineImage:segment.inlineImage} : {}),
            style: segment.inlineImage ? {} : {
              ...(block.style.name?{}:inherited),
              ...readRunStyle(properties,false),
              ...(hyperlink ? { hyperlink } : {}),
            },
          }
          if(run.style.characterStyleId){const id=styleAliases.get(run.style.characterStyleId);if(id)run.style.characterStyleId=id;else{delete run.style.characterStyleId;lose('UNDEFINED_CHARACTER_STYLE','Unknown character style references retain only available direct properties.')}}
          block.runs.push(run)
          if (revision) {
            const id = randomUUID()
            run.changeId = id
            document.changes.push({
              id,
              kind: revision.localName === 'del' ? 'deletion' : 'insertion',
              authorId: 0,
              authorName: 'Imported author',
              importedAuthor: revision.getAttributeNS(w, 'author') ?? 'Unknown imported author',
              createdAt: date(revision.getAttributeNS(w, 'date')),
              status: 'pending',
              origin: 'import',
              targetRunIds: [run.id],
            })
          }
          const format = properties ? child(properties, 'rPrChange') : undefined
          if (format && !run.inlineImage) {
            document.changes.push({
              id: randomUUID(),
              kind: 'format',
              authorId: 0,
              authorName: 'Imported author',
              importedAuthor: format.getAttributeNS(w, 'author') ?? 'Unknown imported author',
              createdAt: date(format.getAttributeNS(w, 'date')),
              status: 'pending',
              origin: 'import',
              targetRunIds: [run.id],
              beforeStyle: (()=>{const style=readRunStyle(child(format,'rPr'),false);if(style.characterStyleId){const id=styleAliases.get(style.characterStyleId);if(id)style.characterStyleId=id;else delete style.characterStyleId}return style})(),
              afterStyle: run.style,
            })
          }
          for (const id of activeComments)
            commentAnchors.set(id, [
              ...(commentAnchors.get(id) ?? []),
              {
                blockId: block.id,
                runId: run.id,
                start: 0,
                end: run.text.length,
                sourceText: run.text,
              },
            ])
          }
        } else if (element.namespaceURI === w && name !== 'pPr')
          visit(element, revision, hyperlink)
      }
    }
    visit(element)
    if (!block.runs.length) block.runs.push({ id: randomUUID(), text: '', style: {} })
    for (const id of pendingPoints) commentAnchors.set(id, [...(commentAnchors.get(id) ?? []), { blockId: block.id, runId: block.runs[0]!.id, start: 0, end: 0, sourceText: '' }])
    const properties=child(element,'pPr');const paragraphRevision=properties?child(properties,'rPr'):undefined
    if (paragraphRevision && block.runs.every((run)=>!run.text&&!run.inlineImage) && !document.changes.some((change)=>change.kind==='format'&&change.targetRunIds.includes(block.runs[0].id))) {const markerStyle=readRunStyle(paragraphRevision);if(markerStyle.characterStyleId)markerStyle.characterStyleId=styleAliases.get(markerStyle.characterStyleId);block.runs[0].style={...markerStyle,...block.runs[0].style}}
    const markFormatting=paragraphRevision?child(paragraphRevision,'rPrChange'):undefined
    if(markFormatting&&block.runs.every((run)=>!run.text&&!run.inlineImage)){const run=block.runs[0];const existing=document.changes.find((change)=>change.kind==='format'&&change.targetRunIds.includes(run.id));const importedAuthor=markFormatting.getAttributeNS(w,'author')??'Unknown imported author';const createdAt=date(markFormatting.getAttributeNS(w,'date'));if(!existing){const beforeStyle=readRunStyle(child(markFormatting,'rPr'),false);if(beforeStyle.characterStyleId)beforeStyle.characterStyleId=styleAliases.get(beforeStyle.characterStyleId);document.changes.push({id:randomUUID(),kind:'format',authorId:0,authorName:'Imported author',importedAuthor,createdAt,status:'pending',origin:'import',targetRunIds:[run.id],beforeStyle,afterStyle:{...run.style}})}else if(existing.importedAuthor!==importedAuthor||existing.createdAt!==createdAt)lose('PARAGRAPH_MARK_FORMAT_CONFLICT','Distinct paragraph-mark and empty-run formatting revisions cannot share one canonical empty target; the separate mark revision remains retained only in the original.')}
    const insert=paragraphRevision?child(paragraphRevision,'ins'):undefined;const deletion=paragraphRevision?child(paragraphRevision,'del'):undefined
    if(insert&&deletion)throw new WordCodecError('DOCUMENT_IMPORT_BOUNDARY_AMBIGUOUS','A paragraph mark has conflicting revisions; preserve the original for reconciliation.',422)
    if (insert || deletion) {
      const mark = insert ?? deletion!
      const textKind = insert ? 'insertion' : 'deletion'
      const textRuns = block.runs.filter((run) => run.text.length)
      const related = textRuns.map((run) => document.changes.find((change) => change.id === run.changeId))
      const wholeParagraph = textRuns.length > 0 && related.every((change) => change?.kind === textKind && change.importedAuthor === (mark.getAttributeNS(w, 'author') ?? 'Unknown imported author') && change.createdAt === date(mark.getAttributeNS(w, 'date')))
      if (wholeParagraph) {
        const redundant = new Set(related.map((change) => change!.id))
        document.changes = document.changes.filter((change) => !redundant.has(change.id))
        for (const run of block.runs) if (run.changeId && redundant.has(run.changeId)) delete run.changeId
        const id = randomUUID(); block.changeId = id
        document.changes.push({ id, kind: insert ? 'paragraphInsertion' : 'paragraphDeletion', authorId: 0, authorName: 'Imported author', importedAuthor: mark.getAttributeNS(w, 'author') ?? 'Unknown imported author', createdAt: date(mark.getAttributeNS(w, 'date')), status: 'pending', origin: 'import', targetRunIds: [], targetBlockIds: [block.id] })
      } else boundaryMarkers.set(block.id, { element: mark, kind: insert ? 'paragraphSplit' : 'paragraphJoin' })
    }
    const formatting=properties?child(properties,'pPrChange'):undefined
    if(formatting){document.changes.push({id:randomUUID(),kind:'paragraphFormat',authorId:0,authorName:'Imported author',importedAuthor:formatting.getAttributeNS(w,'author')??'Unknown imported author',createdAt:date(formatting.getAttributeNS(w,'date')),status:'pending',origin:'import',targetRunIds:[],targetBlockIds:[block.id],beforeParagraphStyle:readParagraphStyle(child(formatting,'pPr')),afterParagraphStyle:{...block.style}})}
    return block
  }
  const date = (raw: string | null) =>
    raw && Number.isFinite(Date.parse(raw))
      ? new Date(raw).toISOString()
      : '1970-01-01T00:00:00.000Z'
  const image = (element: Element, part = 'word/document.xml'): Extract<DocumentBlock, {type: 'image'}> | null => {
    const inline = element.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'inline').item(0)
    const effects = element.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'effectExtent').item(0)
    const crop = element.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'srcRect').item(0)
    if (inline && ['distT','distB','distL','distR'].some(attribute => !inline.hasAttribute(attribute))) lose('IMAGE_DISTANCE_UNSPECIFIED', 'Omitted inline distances have differing application defaults. Export uses explicit zero distances; the original must pass native comparison before conversion is eligible.')
    if (inline && ['distT','distB','distL','distR'].some(attribute => number(inline.getAttribute(attribute)) !== 0) || effects && ['t','b','l','r'].some(attribute => number(effects.getAttribute(attribute)) !== 0) || crop && ['t','b','l','r'].some(attribute => number(crop.getAttribute(attribute)) !== 0)) lose('IMAGE_PRESENTATION_UNSUPPORTED', 'Nonzero inline distances, drawing effects and image cropping require a presentation model. Preserve the original; this candidate is not fidelity eligible.')
    const drawing = element
      .getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')
      .item(0)
    if (!drawing) return null
    const relation = relationships(part).get(drawing.getAttributeNS(r, 'embed')!)
    if (!relation || relation.external) {
      lose(
        'EXTERNAL_IMAGE',
        'External images are retained as original references and never fetched.',
      )
      return null
    }
    const data = files.get(relation.target)
    if (!data)
      throw new WordCodecError('DOCUMENT_IMPORT_INVALID', 'Image relationship is unavailable.', 422)
    const size = imageSize(data)
    if (!size) {
      lose('UNSUPPORTED_IMAGE', 'Only PNG/JPEG inline image bytes can be converted safely.')
      return null
    }
    if (size.width > 16384 || size.height > 16384 || size.width * size.height > 64 * 1024 * 1024)
      throw new WordCodecError(
        'DOCUMENT_IMPORT_IMAGE_LIMIT',
        'Image dimensions exceed import limits.',
        422,
      )
    const extent = element
      .getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
        'extent',
      )
      .item(0)
    const width = extent ? number(extent.getAttribute('cx')) / 9525 : size.width
    const height = extent ? number(extent.getAttribute('cy')) / 9525 : size.height
    const id = assets.length + 1
    const sha256 = bytesSha256(data)
    assets.push({
      placeholderId: id,
      sha256,
      mediaType: size.mediaType,
      bytesBase64: data.toString('base64'),
      width: size.width,
      height: size.height,
    })
    const property = element
      .getElementsByTagNameNS(
        'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
        'docPr',
      )
      .item(0)
    return {
      type: 'image',
      id: randomUUID(),
      assetId: id,
      sha256,
      alt: property?.getAttribute('descr') ?? '',
      width,
      height,
    }
  }
  const sectionEnds: Array<{end: number; element: Element | undefined}> = []
  const parseBlocks = (container: Element, part = 'word/document.xml', depth = 0): DocumentBlock[] => {
    if (depth > 8) throw new WordCodecError('DOCUMENT_NESTING_LIMIT', 'Nested tables exceed eight levels.', 413)
    const result: DocumentBlock[] = []
    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType !== 1) continue
      const element = node as Element
      if (element.namespaceURI !== w) continue
      if (element.localName === 'p') {
        const breaks = Array.from(element.getElementsByTagNameNS(w, 'br'))
        if (breaks.length && breaks.every((item) => item.getAttributeNS(w, 'type') === 'page') && !element.getElementsByTagNameNS(w, 't').length && !element.getElementsByTagNameNS(w, 'drawing').length) { for (let index = 0; index < breaks.length; index++) result.push({ type: 'pageBreak', id: randomUUID() }); continue }
        const block = paragraph(element,part)
        result.push(block)
        const properties = child(element, 'pPr'); const section = properties ? child(properties, 'sectPr') : undefined
        if (section && container === body) sectionEnds.push({ end: result.length, element: section })
      } else if (element.localName === 'tbl') {
        const rows = direct(element, 'tr').map((row) => ({
          id: randomUUID(),
          keepTogether: enabled(child(row, 'trPr') ?? row, 'cantSplit'),
          repeatHeader: enabled(child(row, 'trPr') ?? row, 'tblHeader'),
          cells: direct(row, 'tc').map((cell) => ({
            id: randomUUID(),
            paragraphs: [],
            blocks: parseBlocks(cell, part, depth + 1),
            presentation: readCellPresentation(child(cell, 'tcPr'), lose),
          })),
        }))
        if (!rows.length) continue
        const columns = rows[0].cells.length
        if (!columns || rows.some((row) => row.cells.length !== columns))
          throw new WordCodecError(
            'DOCUMENT_IMPORT_TABLE_UNSUPPORTED',
            'Irregular/merged tables require independent conversion. Original is retained.',
            422,
          )
        if (
          element.getElementsByTagNameNS(w, 'gridSpan').length ||
          element.getElementsByTagNameNS(w, 'vMerge').length
        )
          throw new WordCodecError(
            'DOCUMENT_IMPORT_TABLE_UNSUPPORTED',
            'Merged cells cannot be safely preserved.',
            422,
          )
        const grid = child(element, 'tblGrid')
        const widths = grid
          ? direct(grid, 'gridCol').map(
              (column) => number(column.getAttributeNS(w, 'w'), 1800) / 15,
            )
          : Array.from({ length: columns }, () => 120)
        if (widths.length !== columns)
          throw new WordCodecError(
            'DOCUMENT_IMPORT_TABLE_UNSUPPORTED',
            'Table grid does not match cells.',
            422,
          )
        for (const row of rows)
          for (const cell of row.cells)
            if (!cell.blocks.length)
              cell.blocks.push({
                type: 'paragraph',
                id: randomUUID(),
                style: {},
                runs: [{ id: randomUUID(), text: '', style: {} }],
              })
        result.push({ type: 'table', id: randomUUID(), widths, rows, presentation: readTablePresentation(child(element, 'tblPr'), lose) })
      } else if (element.localName === 'sdt') {
        const content = child(element, 'sdtContent')
        if (content) result.push(...parseBlocks(content,part,depth + 1))
      }
    }
    return result
  }
  document.blocks = parseBlocks(body)
  const normal = styles.get(defaultParagraphId)?.run
  const baseLayout = defaultLayout(); baseLayout.pageNumbers=false; if(fonts.length)baseLayout.embeddedFontFaces=fonts.flatMap(font=>(['regular','bold','italic','boldItalic'] as const).flatMap(slot=>{const face=font[slot];return face?[{family:font.family,slot,sha256:face.sha256,fontKey:face.fontKey}]:[]})); if (normal?.font) baseLayout.font = normal.font; if (normal?.size) baseLayout.fontSize = normal.size
  const readSectionLayout = (section: Element | undefined): {layout:DocumentLayout;stories:{header?:WordDocument;footer?:WordDocument}} => {
    const layout = structuredClone(baseLayout);const stories:{header?:WordDocument;footer?:WordDocument}={}; if (!section) return {layout,stories}
    const columns = child(section, 'cols')
    if (columns && !direct(columns, 'col').length && columns.getAttributeNS(w, 'equalWidth') !== '0') layout.columns = { count: number(columns.getAttributeNS(w, 'num'), 1), gap: number(columns.getAttributeNS(w, 'space'), 720) / 15 }
    const size = child(section, 'pgSz')
    if (size) { layout.width = number(size.getAttributeNS(w, 'w'), 11910) / 15; layout.height = number(size.getAttributeNS(w, 'h'), 16845) / 15 }
    const margin = child(section, 'pgMar'); if (margin) layout.margins = ['top','right','bottom','left'].map((key) => number(margin.getAttributeNS(w, key), 1140) / 15) as DocumentLayout['margins']
    if (margin) { layout.headerDistance = number(margin.getAttributeNS(w, 'header'), 360) / 15; layout.footerDistance = number(margin.getAttributeNS(w, 'footer'), 360) / 15; layout.gutter = number(margin.getAttributeNS(w, 'gutter'), 0) / 15 }
    const relations = relationships('word/document.xml')
    for (const story of ['header','footer'] as const) {
      const refs = direct(section, `${story}Reference`); const ref = refs.find((reference)=>reference.getAttributeNS(w,'type')==='default') ?? refs[0]; const target = ref ? relations.get(ref.getAttributeNS(r, 'id')!) : undefined
      if (target && !target.external && files.has(target.target)) {
        const root = parseDocumentXml(files.get(target.target)!);if(story==='footer')footerParts.add(target.target);const storyDocument=makeDocument();storyDocument.layout={...structuredClone(layout),header:[],footer:[]};storyDocument.blocks=parseBlocks(root.documentElement!,target.target);stories[story]=storyDocument;layout[story]=storyDocument.blocks.filter((block):block is DocumentParagraph=>block.type==='paragraph')
        if (story === 'footer') layout.pageNumbers = mappedPageParts.has(target.target)
      }
    }
    return {layout,stories}
  }
  const finalSection = direct(body,'sectPr')[0]
  sectionEnds.push({end: document.blocks.length, element: finalSection})
  const sections: DocxSection[] = []; let sectionStart = 0
  for (const entry of sectionEnds) {
    const {layout,stories} = readSectionLayout(entry.element)
    const rawBreak = entry.element ? val(child(entry.element, 'type')) ?? 'nextPage' : 'nextPage'
    const breakAfter = rawBreak === 'continuous' ? 'continuous' : 'nextPage'
    if (rawBreak !== 'continuous' && rawBreak !== 'nextPage') lose('SOURCE_SECTION_BREAK', 'Odd/even-page and column section breaks require explicit conversion handling.')
    if (entry.end > sectionStart || !sections.length) sections.push({ start: sectionStart, end: entry.end, breakAfter, document: { ...document, blocks: document.blocks.slice(sectionStart, entry.end), layout },stories })
    sectionStart = entry.end
  }
  document.layout = sections[0]?.document.layout ?? baseLayout
  const comments = files.get('word/comments.xml')
  if (comments) {
    for (const element of Array.from(
      parseDocumentXml(comments).getElementsByTagNameNS(w, 'comment'),
    )) {
      const anchors = commentAnchors.get(element.getAttributeNS(w, 'id')!)
      if (!anchors?.length) {
        lose(
          'ORPHANED_COMMENT',
          'Comments without supported anchored text remain in the original.',
        )
        continue
      }
      document.comments.push({
        id: randomUUID(),
        authorId: 0,
        authorName: 'Imported author',
        importedAuthor: element.getAttributeNS(w, 'author') ?? 'Unknown imported author',
        createdAt: date(element.getAttributeNS(w, 'date')),
        text: Array.from(element.getElementsByTagNameNS(w, 't'))
          .map((value) => value.textContent ?? '')
          .join(''),
        anchors,
        resolved: false,
      })
    }
  }
  const bindBoundaries=(items:DocumentBlock[])=>{for(let index=0;index<items.length;index++){const block=items[index];const mark=boundaryMarkers.get(block.id);if(!mark)continue;if(block.type!=='paragraph'||items[index+1]?.type!=='paragraph')throw new WordCodecError('DOCUMENT_IMPORT_BOUNDARY_UNSUPPORTED','A revised paragraph mark has no adjacent supported paragraph in its container.',422);const right=items[index+1] as DocumentParagraph;const id=randomUUID();block.boundaryChangeId=id;document.changes.push({id,kind:mark.kind,authorId:0,authorName:'Imported author',importedAuthor:mark.element.getAttributeNS(w,'author')??'Unknown imported author',createdAt:date(mark.element.getAttributeNS(w,'date')),status:'pending',origin:'import',targetRunIds:[],targetBlockIds:[block.id,right.id]});boundaryMarkers.delete(block.id)}}
  bindBoundaries(document.blocks);for(const section of sections)for(const story of Object.values(section.stories??{})){bindBoundaries(story.blocks);for(const block of allBlocks(story.blocks))if(block.type==='table')for(const row of block.rows)for(const cell of row.cells)bindBoundaries(cellBlocks(cell))}for(const block of allBlocks(document.blocks))if(block.type==='table')for(const row of block.rows)for(const cell of row.cells)bindBoundaries(cellBlocks(cell))
  if(boundaryMarkers.size)throw new WordCodecError('DOCUMENT_IMPORT_BOUNDARY_UNSUPPORTED','Revised paragraph marks in unconverted containers cannot be safely imported.',422)
  const retainReview = (item: WordDocument) => {
    const paragraphs = paragraphsOf(item, true); const blocks = new Set(paragraphs.map((block) => block.id)); const runs = new Set(paragraphs.flatMap((block) => block.runs.map((run) => run.id)))
    return { ...item, changes: document.changes.filter((change) => change.targetRunIds.every((id) => runs.has(id)) && (change.targetBlockIds ?? []).every((id) => blocks.has(id))), comments: document.comments.filter((comment) => comment.anchors.every((anchor) => runs.has(anchor.runId))) }
  }
  for (const section of sections) { section.document = retainReview(section.document); validateDocument(section.document);for(const kind of ['header','footer'] as const){const story=section.stories?.[kind];if(story){section.stories![kind]=retainReview(story);validateDocument(section.stories![kind])}} }
  const storyCommentIds=new Set(sections.flatMap((section)=>Object.values(section.stories??{}).flatMap((story)=>story.comments.map((comment)=>comment.id))))
  if(storyCommentIds.size)lose('HEADER_FOOTER_COMMENTS','Word ignores comment ranges in header/footer stories. They remain canonical imported annotations and in the original, with explicit review-sidecar export.',storyCommentIds.size)
  const retainedCommentIds = new Set(sections.flatMap((section) => [...section.document.comments,...Object.values(section.stories??{}).flatMap((story)=>story.comments)].map((comment) => comment.id)))
  const omittedComments = document.comments.filter((comment) => !retainedCommentIds.has(comment.id))
  if (omittedComments.length) lose('CROSS_SECTION_COMMENT', 'Comments spanning section documents remain in the preserved original for reconciliation.', omittedComments.length)
  const compatibleDocument = retainReview(document); validateDocument(compatibleDocument)
  return {document: compatibleDocument,sections,styleDefinitions,fonts,assets,losses:Array.from(losses.values()),detected}
}

function imageSize(
  bytes: Buffer,
): { width: number; height: number; mediaType: 'image/png' | 'image/jpeg' } | null {
  if (
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      mediaType: 'image/png',
    }
  if (bytes[0] !== 255 || bytes[1] !== 216) return null
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 255) return null
    const marker = bytes[offset + 1]
    offset += 2
    if (marker === 216 || marker === 217) continue
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) return null
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
        mediaType: 'image/jpeg',
      }
    offset += length
  }
  return null
}
