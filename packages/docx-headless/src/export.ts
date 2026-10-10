import { createHash } from 'node:crypto'
import { createZipBuffer, type ZipEntry } from './zipArchive'
import { type WordDocument, type DocumentParagraph, type TextStyle, type DocumentView, type ParagraphStyle, type DocumentBlock, visibleParagraph, visibleRun, runStyle, paragraphsOf, paragraphStyle, logicalParagraphs, paragraphBoundaryVisible } from './model'
import { validateStyles,type WordStyleDefinitions } from './styles'
import { composeWordStories, type WordStories } from './stories'
import { WordCodecError } from './errors'
import { validateDocxPackage } from './packageValidation'

export type ExportMode = 'retain-review' | 'final' | 'original';
export interface DocxAsset { bytes: Buffer; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' }
const xml = (value: string) => {
  if (Array.from(value).some(character => { const code = character.codePointAt(0) ?? 0; return code >= 0xd800 && code <= 0xdfff || code <= 8 || code === 11 || code === 12 || code >= 14 && code <= 31 || code === 0xfffe || code === 0xffff })) throw new WordCodecError('EXPORT_XML_TEXT_UNSUPPORTED', 'Text contains characters unsupported by OOXML. The canonical document remains unchanged.', 422)
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\r/g,'&#13;')
}
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const ns = `xmlns:w="${w}" xmlns:r="${r}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"`
const twips = (px: number) => Math.round(px * 15)
function styleXml(style: TextStyle): string {
  // CT_RPr has a prescribed order; XML well-formedness alone cannot check it.
  return [
    style.characterStyleId?`<w:rStyle w:val="${xml(style.characterStyleId)}"/>`:'',
    style.font ? `<w:rFonts w:ascii="${xml(style.font)}" w:hAnsi="${xml(style.font)}"/>` : '',
    style.bold === undefined ? '' : style.bold ? '<w:b/>' : '<w:b w:val="0"/>',
    style.italic === undefined ? '' : style.italic ? '<w:i/>' : '<w:i w:val="0"/>',
    style.strikeout === undefined ? '' : `<w:strike w:val="${style.strikeout ? '1' : '0'}"/>`,
    style.color ? `<w:color w:val="${style.color.slice(1)}"/>` : '',
    style.size ? `<w:sz w:val="${Math.round(style.size * 1.5)}"/>` : '',
    style.underline === undefined ? '' : `<w:u w:val="${style.underline ? 'single' : 'none'}"/>`,
    style.highlight ? `<w:shd w:fill="${style.highlight.slice(1)}"/>` : '',
  ].join('')
}
/** Headless OOXML generation. No DOM, download, browser cookies or remote fetches. */
export async function exportDocx(raw: WordDocument, mode: ExportMode, assets: Map<number, DocxAsset> = new Map(), ownedStories?:WordStories, definitions:WordStyleDefinitions={}): Promise<Buffer> {
  validateStyles(definitions)
  const {document,headerBlocks,footerBlocks} = composeWordStories(raw,ownedStories); const view: DocumentView = mode === 'retain-review' ? 'markup' : mode
  const files: ZipEntry[] = []; const relationships: string[] = []
  const stories = { main: relationships, header: [] as string[], footer: [] as string[] }
  let story: keyof typeof stories = 'main'
  const relation = (type: string, target: string, external = false) => { const list = stories[story]; const id = `rId${list.length + 1}`; list.push(`<Relationship Id="${id}" Type="${r}/${type}" Target="${xml(target)}"${external ? ' TargetMode="External"' : ''}/>`); return id }
  relation('styles', 'styles.xml'); relation('settings', 'settings.xml')
  let revisionId = 0; let drawingId = 0
  const media = new Set<string>()
  const commentIds = new Map(document.comments.map((comment, index) => [comment.id, index]))
  const commentStarts = new Map<string, Array<{ id: number; offset: number }>>()
  const commentEnds = new Map<string, Array<{ id: number; offset: number }>>()
  const storyRuns = [document.layout.header, paragraphsOf(document), document.layout.footer].map((paragraphs) => paragraphs.filter((block) => visibleParagraph(block, document.changes, view)).flatMap((block) => block.runs.filter((run) => visibleRun(run, document.changes, view))))
  if (mode === 'retain-review') for (const comment of document.comments) {
    const bodyRuns=new Set(paragraphsOf(document).flatMap((paragraph)=>paragraph.runs.map((run)=>run.id)))
    if(comment.anchors.some((anchor)=>!bodyRuns.has(anchor.runId)))throw new WordCodecError('EXPORT_COMMENT_STORY_UNSUPPORTED','Word ignores native comment anchors in header/footer stories. Preserve them in an explicit review sidecar.',409)
    const first = comment.anchors[0]!; const last = comment.anchors.at(-1)!
    const runs = storyRuns.find((list) => list.some((run) => run.id === first.runId))
    const start = runs?.findIndex((run) => run.id === first.runId) ?? -1
    const end = runs?.findIndex((run) => run.id === last.runId) ?? -1
    if (!runs || start < 0 || end < start || end - start + 1 !== comment.anchors.length || comment.anchors.some((anchor, index) => runs[start + index]?.id !== anchor.runId || (index > 0 && anchor.start !== 0) || (index < comment.anchors.length - 1 && anchor.end !== runs[start + index]!.text.length))) throw new WordCodecError('EXPORT_COMMENT_RANGE_UNSUPPORTED', 'DOCX comments require one contiguous range in a single document story.', 409)
    const id = commentIds.get(comment.id)!
    commentStarts.set(first.runId, [...(commentStarts.get(first.runId) ?? []), { id, offset: first.start }])
    commentEnds.set(last.runId, [...(commentEnds.get(last.runId) ?? []), { id, offset: last.end }])
  }
  for(const paragraph of paragraphsOf(document,true)){for(const style of [paragraph.style,...document.changes.filter((change)=>change.targetBlockIds?.includes(paragraph.id)).flatMap((change)=>[change.beforeParagraphStyle,change.afterParagraphStyle])])if(style?.name&&!/^Normal$|^Heading[1-6]$/.test(style.name)&&(!Object.hasOwn(definitions,style.name)||definitions[style.name].kind==='character'))throw new WordCodecError('EXPORT_STYLE_UNAVAILABLE','Paragraph style has no owned definition.',409);for(const style of [...paragraph.runs.map((run)=>run.style),...document.changes.filter((change)=>change.targetRunIds.some((id)=>paragraph.runs.some((run)=>run.id===id))).flatMap((change)=>[change.beforeStyle,change.afterStyle])])if(style?.characterStyleId&&(!Object.hasOwn(definitions,style.characterStyleId)||definitions[style.characterStyleId].kind!=='character'))throw new WordCodecError('EXPORT_STYLE_UNAVAILABLE','Character style has no owned definition.',409)}
  const listIds = new Map<string, number>()
  const listKinds: Array<'bullet' | 'number'> = []
  for (const paragraphs of [paragraphsOf(document), document.layout.header, document.layout.footer]) {
    let previous: 'bullet' | 'number' | undefined; let current = 0
    for (const block of paragraphs) {
      if (block.style.name && !/^Normal$|^Heading[1-6]$/.test(block.style.name) && !definitions[block.style.name]) throw new WordCodecError('EXPORT_STYLE_UNAVAILABLE', `Named style ${block.style.name} has no definition in this document.`, 409)
      const kind = block.style.list
      if (kind && kind !== previous) { listKinds.push(kind); current = listKinds.length }
      if (kind) listIds.set(block.id+':'+kind, current)
      for(const change of document.changes.filter((change)=>change.kind==='paragraphFormat'&&change.targetBlockIds?.includes(block.id))){for(const style of [change.beforeParagraphStyle,change.afterParagraphStyle])if(style?.list&&!listIds.has(block.id+':'+style.list)){listKinds.push(style.list);listIds.set(block.id+':'+style.list,listKinds.length)}}
      previous = kind
    }
  }
  for(const [id,definition] of Object.entries(definitions))if(definition.paragraph.list){listKinds.push(definition.paragraph.list);listIds.set('style:'+id+':'+definition.paragraph.list,listKinds.length)}
  if (listKinds.length) relation('numbering', 'numbering.xml')
  const paragraphProperties=(style:ParagraphStyle,blockId:string):string=>[
      style.heading ? `<w:pStyle w:val="Heading${style.heading}"/>` : style.name ? `<w:pStyle w:val="${xml(style.name)}"/>` : '',
      style.keepWithNext===undefined?'':`<w:keepNext w:val="${style.keepWithNext?'1':'0'}"/>`,
      style.pageBreakBefore===undefined?'':`<w:pageBreakBefore w:val="${style.pageBreakBefore?'1':'0'}"/>`,
      style.list ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${listIds.get(blockId+':'+style.list)}"/></w:numPr>` : '',
      style.lineSpacing!==undefined||style.before!==undefined||style.after!==undefined?`<w:spacing${style.lineSpacing===undefined?'':` w:line="${Math.round(style.lineSpacing*240)}" w:lineRule="auto"`}${style.before===undefined?'':` w:before="${twips(style.before)}"`}${style.after===undefined?'':` w:after="${twips(style.after)}"`}/>`:'',
      style.indent!==undefined||style.firstLineIndent!==undefined?`<w:ind${style.indent===undefined?'':` w:left="${twips(style.indent)}"`}${style.firstLineIndent===undefined?'':` ${style.firstLineIndent<0?'w:hanging':'w:firstLine'}="${twips(Math.abs(style.firstLineIndent))}"`}/>`:'',
      style.alignment ? `<w:jc w:val="${style.alignment === 'justify' ? 'both' : style.alignment}"/>` : '',
    ].join('')
  const imageRun = (block: { id: string; assetId: number; sha256: string; alt: string; width: number; height: number }): string => {
      const asset = assets.get(block.assetId)
      if (!asset || createHash('sha256').update(asset.bytes).digest('hex') !== block.sha256) throw new WordCodecError('EXPORT_ASSET_UNAVAILABLE', 'Verified image bytes are required for DOCX export.', 409)
      const extension = asset.mediaType === 'image/jpeg' ? 'jpg' : asset.mediaType === 'image/png' ? 'png' : 'webp'
      if (extension === 'webp') throw new WordCodecError('EXPORT_IMAGE_CONVERSION_REQUIRED', 'Convert WebP to a verified PNG before DOCX export.', 409)
      const filename = `image-${block.assetId}.${extension}`
      if (!media.has(filename)) { files.push({ name: `word/media/${filename}`, content: asset.bytes }); media.add(filename) }
      const graphicId = ++drawingId
      const id = relation('image', `media/${filename}`); const cx = Math.round(block.width * 9525); const cy = Math.round(block.height * 9525)
      return `<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${graphicId}" name="${xml(block.id)}" descr="${xml(block.alt)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${graphicId}" name="${xml(filename)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  }
  const characterStyle=(id:string|undefined,seen=new Set<string>()):TextStyle=>{if(!id)return {};if(seen.has(id)||seen.size>=32)throw new WordCodecError('EXPORT_STYLE_INVALID','Character style inheritance is cyclic or too deep.',409);const definition=definitions[id];if(!definition||definition.kind!=='character')throw new WordCodecError('EXPORT_STYLE_UNAVAILABLE','Character style has no owned definition.',409);return {...characterStyle(definition.run.characterStyleId,new Set([...seen,id])),...definition.run}}
  const effectiveRunStyle=(run:import('./model').DocumentRun,block:DocumentParagraph,selectedView:DocumentView=view):TextStyle=>{const direct=runStyle(run,document.changes,selectedView);const name=paragraphStyle(block,document.changes,selectedView).name;const base=name?definitions[name]?.run:undefined;const layout=story==='header'?ownedStories?.header?.layout:story==='footer'?ownedStories?.footer?.layout:undefined;return {...(layout?{font:layout.font,size:layout.fontSize}:{}),...characterStyle(base?.characterStyleId),...base,...characterStyle(direct.characterStyleId),...direct}}
  const paragraph = (block: DocumentParagraph): string => {
    if (!visibleParagraph(block, document.changes, view)) return ''
    const paragraphChange = document.changes.find((change) => change.id === block.changeId && change.status === 'pending')
    const paragraphTag = paragraphChange?.kind === 'paragraphDeletion' ? 'del' : 'ins'
    const paragraphRevision = mode === 'retain-review' && paragraphChange ? `<w:rPr><w:${paragraphTag} w:id="${revisionId++}" w:author="${xml(paragraphChange.importedAuthor ?? paragraphChange.authorName)}" w:date="${paragraphChange.createdAt}"/></w:rPr>` : ''
    const style = paragraphStyle(block,document.changes,view)
    const formatting=document.changes.find((change)=>change.kind==='paragraphFormat'&&change.status==='pending'&&change.targetBlockIds?.includes(block.id))
    const boundary=document.changes.find((change)=>change.id===block.boundaryChangeId&&change.status==='pending'&&['paragraphSplit','paragraphJoin'].includes(change.kind))
    const boundaryRevision=mode==='retain-review'&&boundary?`<w:rPr><w:${boundary.kind==='paragraphSplit'?'ins':'del'} w:id="${revisionId++}" w:author="${xml(boundary.importedAuthor??boundary.authorName)}" w:date="${boundary.createdAt}"/></w:rPr>`:''
    const formatRevision=mode==='retain-review'&&formatting?`<w:pPrChange w:id="${revisionId++}" w:author="${xml(formatting.importedAuthor??formatting.authorName)}" w:date="${formatting.createdAt}"><w:pPr>${paragraphProperties(formatting.beforeParagraphStyle??{},block.id)}</w:pPr></w:pPrChange>`:''
    const visibleRuns=block.runs.filter((run)=>visibleRun(run,document.changes,view))
    const empty=visibleRuns.every((run)=>!run.text&&!run.inlineImage)
    const lineStyle=empty?{font:document.layout.font,size:document.layout.fontSize,...effectiveRunStyle(visibleRuns.find((run)=>!run.inlineImage)??{id:'empty-line-box',text:'',style:{}},block)}:undefined
    const emptyRun=visibleRuns.find((run)=>!run.inlineImage)
    const emptyFormat=emptyRun?document.changes.find((change)=>change.kind==='format'&&change.status==='pending'&&change.targetRunIds.includes(emptyRun.id)):undefined
    const beforeLineStyle=emptyRun?{font:document.layout.font,size:document.layout.fontSize,...effectiveRunStyle(emptyRun,block,'original')}:undefined
    const markFormatting=mode==='retain-review'&&emptyFormat&&beforeLineStyle?`<w:rPrChange w:id="${revisionId++}" w:author="${xml(emptyFormat.importedAuthor??emptyFormat.authorName)}" w:date="${emptyFormat.createdAt}"><w:rPr>${styleXml(beforeLineStyle)}</w:rPr></w:rPrChange>`:''
    const markStyle=lineStyle?styleXml(lineStyle)+markFormatting:''
    const markRevision=(paragraphRevision+boundaryRevision).replace(/<\/?w:rPr>/g,'')
    const mark=markStyle||markRevision?`<w:rPr>${markStyle}${markRevision}</w:rPr>`:''
    const properties=paragraphProperties(style,block.id)+mark+formatRevision
    const runs: string[] = []
    for (const run of block.runs) {
      if (!visibleRun(run, document.changes, view)) continue
      const change = document.changes.find((item) => item.id === run.changeId && item.status === 'pending') ?? paragraphChange
      const formatting = document.changes.find((item) => item.kind === 'format' && item.status === 'pending' && item.targetRunIds.includes(run.id))
      const native = mode === 'retain-review'
      const tag = native && (change?.kind === 'deletion' || change?.kind === 'paragraphDeletion') ? 'delText' : 't'
      const boundaries = new Set<number>([0, run.text.length])
      const starts = commentStarts.get(run.id) ?? []; const ends = commentEnds.get(run.id) ?? [];
      [...starts, ...ends].forEach(({ offset }) => boundaries.add(offset))
      const offsets = [...boundaries].sort((a, b) => a - b)
      let content = ''
      for (let index = 0; index < offsets.length; index++) {
        const offset = offsets[index]
        for (const marker of ends) if (marker.offset === offset && !starts.some((start) => start.id === marker.id && start.offset === offset)) content += `<w:commentRangeEnd w:id="${marker.id}"/><w:r><w:commentReference w:id="${marker.id}"/></w:r>`
        for (const marker of starts) if (marker.offset === offset) content += `<w:commentRangeStart w:id="${marker.id}"/>`
        for (const marker of ends) if (marker.offset === offset && starts.some((start) => start.id === marker.id && start.offset === offset)) content += `<w:commentRangeEnd w:id="${marker.id}"/><w:r><w:commentReference w:id="${marker.id}"/></w:r>`
        if (index === offsets.length - 1) continue
        const text = run.text.slice(offset, offsets[index + 1])
        const textXml = text.split(/(\n|\t)/).map((part) => part === '\n' ? '<w:br/>' : part === '\t' ? '<w:tab/>' : `<w:${tag} xml:space="preserve">${xml(part)}</w:${tag}>`).join('')
        const formatChange = native && formatting ? `<w:rPrChange w:id="${revisionId++}" w:author="${xml(formatting.importedAuthor ?? formatting.authorName)}" w:date="${formatting.createdAt}"><w:rPr>${styleXml(story==='main'?(formatting.beforeStyle ?? {}):effectiveRunStyle(run,block,'original'))}</w:rPr></w:rPrChange>` : ''
        content += `<w:r><w:rPr>${styleXml(effectiveRunStyle(run,block))}${formatChange}</w:rPr>${textXml}</w:r>`
      }
      if (!run.text && !run.inlineImage) {const formatChange=native&&formatting?`<w:rPrChange w:id="${revisionId++}" w:author="${xml(formatting.importedAuthor??formatting.authorName)}" w:date="${formatting.createdAt}"><w:rPr>${styleXml(story==='main'?(formatting.beforeStyle??{}):effectiveRunStyle(run,block,'original'))}</w:rPr></w:rPrChange>`:'';content+=`<w:r><w:rPr>${styleXml(effectiveRunStyle(run,block))}${formatChange}</w:rPr><w:${tag} xml:space="preserve"></w:${tag}></w:r>`}
      if (run.inlineImage) content += imageRun({ id: run.id, ...run.inlineImage })
      const hyperlink = effectiveRunStyle(run,block).hyperlink
      if (hyperlink) { const id = relation('hyperlink', hyperlink, true); content = `<w:hyperlink r:id="${id}">${content}</w:hyperlink>` }
      if (native && change && change.kind !== 'format') {
        const tag = (change.kind === 'insertion' || change.kind === 'paragraphInsertion') ? 'ins' : 'del'
        content = `<w:${tag} w:id="${revisionId++}" w:author="${xml(change.importedAuthor ?? change.authorName)}" w:date="${change.createdAt}">${content}</w:${tag}>`
      }
      runs.push(content)
    }
    return `<w:p><w:pPr>${properties}</w:pPr>${runs.join('')}</w:p>`
  }
  const renderBlocks = (blocks:DocumentBlock[]):string[] => { const body:string[]=[]
  for (const [index,block] of blocks.entries()) {
    if (block.type === 'paragraph') { const previous=blocks[index-1];if(previous?.type==='paragraph'&&visibleParagraph(previous,document.changes,view)&&!paragraphBoundaryVisible(previous,block,document.changes,view))continue;const group:DocumentParagraph[]=[block];let next=index+1;while(blocks[next]?.type==='paragraph'&&visibleParagraph(blocks[next] as DocumentParagraph,document.changes,view)&&!paragraphBoundaryVisible(group.at(-1)!,blocks[next] as DocumentParagraph,document.changes,view))group.push(blocks[next++] as DocumentParagraph);body.push(paragraph({...block,runs:group.flatMap((item)=>item.runs)})) }
    else if (block.type === 'pageBreak') body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    else if (block.type === 'table') body.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${block.widths.map((width) => `<w:gridCol w:w="${twips(width)}"/>`).join('')}</w:tblGrid>${block.rows.map((row) => `<w:tr>${row.cells.map((cell, index) => `<w:tc><w:tcPr><w:tcW w:w="${twips(block.widths[index])}" w:type="dxa"/></w:tcPr>${logicalParagraphs(cell.paragraphs,document.changes,view).map(paragraph).join('')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`)
    else {
      body.push(`<w:p>${imageRun(block)}</w:p>`)
    }
  }
  return body }
  const body = renderBlocks(document.blocks)
  const headerId = relation('header', 'header1.xml'); const footerId = relation('footer', 'footer1.xml')
  story = 'header'
  files.push({ name: 'word/header1.xml', content: `${declaration}<w:hdr ${ns}>${renderBlocks(headerBlocks).join('') || '<w:p/>'}</w:hdr>` })
  story = 'footer'
  files.push({ name: 'word/footer1.xml', content: `${declaration}<w:ftr ${ns}>${renderBlocks(footerBlocks).join('')}${document.layout.pageNumbers ? '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>' : '<w:p/>'}</w:ftr>` })
  story = 'main'
  for (const name of ['header', 'footer'] as const) if (stories[name].length) files.push({ name: `word/_rels/${name}1.xml.rels`, content: `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${stories[name].join('')}</Relationships>` })
  if (listKinds.length) files.push({ name: 'word/numbering.xml', content: `${declaration}<w:numbering xmlns:w="${w}">${['bullet', 'number'].map((kind, index) => `<w:abstractNum w:abstractNumId="${index}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${kind === 'bullet' ? 'bullet' : 'decimal'}"/><w:lvlText w:val="${kind === 'bullet' ? '•' : '%1.'}"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>`).join('')}${listKinds.map((kind, index) => `<w:num w:numId="${index + 1}"><w:abstractNumId w:val="${kind === 'bullet' ? 0 : 1}"/></w:num>`).join('')}</w:numbering>` })
  if (mode === 'retain-review' && document.comments.length) {
    relation('comments', 'comments.xml')
    files.push({ name: 'word/comments.xml', content: `${declaration}<w:comments xmlns:w="${w}">${document.comments.map((comment) => `<w:comment w:id="${commentIds.get(comment.id)}" w:author="${xml(comment.importedAuthor ?? comment.authorName)}" w:date="${comment.createdAt}"><w:p><w:r><w:t xml:space="preserve">${xml(comment.text)}</w:t></w:r></w:p></w:comment>`).join('')}</w:comments>` })
  }
  const [top, right, bottom, left] = document.layout.margins
  body.push(`<w:sectPr><w:headerReference w:type="default" r:id="${headerId}"/><w:footerReference w:type="default" r:id="${footerId}"/><w:pgSz w:w="${twips(document.layout.width)}" w:h="${twips(document.layout.height)}"${document.layout.width > document.layout.height ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${twips(top)}" w:right="${twips(right)}" w:bottom="${twips(bottom)}" w:left="${twips(left)}" w:header="360" w:footer="360" w:gutter="0"/>${document.layout.columns ? `<w:cols w:num="${document.layout.columns.count}" w:space="${twips(document.layout.columns.gap)}" w:equalWidth="1"/>` : ''}</w:sectPr>`)
  const overrides = ['document', 'styles', 'settings', 'comments', 'numbering'].filter((name) => (name !== 'comments' || mode === 'retain-review' && document.comments.length) && (name !== 'numbering' || listKinds.length)).map((name) => `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${name === 'document' ? 'document.main' : name}+xml"/>`).join('')
  files.push({ name: '[Content_Types].xml', content: `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>${overrides}<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>` })
  files.push({ name: '_rels/.rels', content: `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>` })
  files.push({ name: 'word/document.xml', content: `${declaration}<w:document ${ns}><w:body>${body.join('')}</w:body></w:document>` })
  const namedStyleXml=Object.entries(definitions).sort(([a],[b])=>a.localeCompare(b)).map(([id,definition])=>`<w:style w:type="${definition.kind??'paragraph'}" w:styleId="${xml(id)}"><w:name w:val="${xml(definition.label??id)}"/>${definition.kind==='character'?(definition.run.characterStyleId?`<w:basedOn w:val="${xml(definition.run.characterStyleId)}"/>`:''):`<w:basedOn w:val="${definition.paragraph.heading?'Heading'+definition.paragraph.heading:'Normal'}"/><w:pPr>${paragraphProperties({...definition.paragraph,name:undefined,heading:undefined},'style:'+id)}</w:pPr>`}<w:rPr>${styleXml(definition.kind==='character'?{...definition.run,characterStyleId:undefined}:definition.run)}</w:rPr></w:style>`).join('')
  files.push({ name: 'word/styles.xml', content: `${declaration}<w:styles xmlns:w="${w}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="${xml(document.layout.font)}" w:hAnsi="${xml(document.layout.font)}"/><w:sz w:val="${Math.round(document.layout.fontSize * 1.5)}"/></w:rPr></w:style>${[1, 2, 3, 4, 5, 6].map((level) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="Heading ${level}"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="${level - 1}"/></w:pPr></w:style>`).join('')}${namedStyleXml}</w:styles>` })
  files.push({ name: 'word/settings.xml', content: `${declaration}<w:settings xmlns:w="${w}">${mode === 'retain-review' ? '<w:trackRevisions/>' : ''}</w:settings>` })
  files.push({ name: 'word/_rels/document.xml.rels', content: `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join('')}</Relationships>` })
  const bytes = await createZipBuffer(files); await validateDocxPackage(bytes,true); return bytes
}
