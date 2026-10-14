import { z } from 'zod'
import { MAX_DOCUMENT_BYTES, type WordDocument, type DocumentBlock, paragraphsOf, exchangeDocument, allBlocks, cellBlocks } from './model'
import { WordCodecError } from './errors'
const identifier = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const border = z.object({ style: z.enum(['none', 'single', 'double', 'dashed', 'dotted']), color: z.union([color, z.literal('auto')]), width: z.number().nonnegative().max(12), space: z.number().nonnegative().max(31) }).strict()
const borders = z.object({ top: border.optional(), right: border.optional(), bottom: border.optional(), left: border.optional(), insideHorizontal: border.optional(), insideVertical: border.optional() }).strict()
const length = z.number().nonnegative().max(8192)
const margins = z.tuple([length, length, length, length])
const tablePresentation = z.object({ alignment: z.enum(['left', 'center', 'right']).optional(), indent: length.optional(), layout: z.enum(['fixed', 'auto']).optional(), width: z.object({ type: z.enum(['auto', 'percent', 'absolute']), value: length }).strict().refine(width => width.type !== 'percent' || width.value <= 100).optional(), borders: borders.optional(), shading: color.optional(), margins: margins.optional() }).strict()
const cellPresentation = z.object({ borders: borders.optional(), shading: color.optional(), margins: margins.optional(), verticalAlignment: z.enum(['top', 'center', 'bottom']).optional() }).strict()
const textStyle = z.object({
  characterStyleId:identifier.optional(),
  font: z.string().min(1).max(100).optional(), size: z.number().min(6).max(144).optional(),
  bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(), strikeout: z.boolean().optional(),
  color: color.optional(), highlight: color.optional(), hyperlink: z.string().max(2048).url().refine((value) => /^https?:\/\//i.test(value), 'Only HTTP(S) hyperlinks are supported').optional(),
}).strict()
const paragraphStyle = z.object({ name: z.string().max(100).optional(), alignment: z.enum(['left', 'center', 'right', 'justify']).optional(), lineSpacing: z.number().positive().max(500).optional(), lineRule: z.enum(['auto', 'exact', 'atLeast']).optional(), rightIndent: z.number().min(-500).max(500).optional(), keepTogether: z.boolean().optional(), widowControl: z.boolean().optional(), shading: color.optional(), borders: borders.optional(), before: z.number().min(0).max(500).optional(), after: z.number().min(0).max(500).optional(), indent: z.number().min(-500).max(500).optional(), firstLineIndent: z.number().min(-500).max(500).optional(), keepWithNext: z.boolean().optional(), pageBreakBefore: z.boolean().optional(), heading: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(), list: z.enum(['bullet', 'number']).optional() }).strict().refine(style => style.lineSpacing === undefined || style.lineRule === 'exact' || style.lineRule === 'atLeast' || style.lineSpacing >= 0.5 && style.lineSpacing <= 5, 'Automatic line spacing requires a multiplier between 0.5 and 5')
const inlineImage = z.object({ assetId: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/), alt: z.string().max(2000), width: z.number().positive().max(16384), height: z.number().positive().max(16384) }).strict()
const paragraph = z.object({
  type: z.literal('paragraph'), id: identifier, changeId: identifier.optional(), boundaryChangeId: identifier.optional(),
  style: paragraphStyle,
  runs: z.array(z.object({ id: identifier, text: z.string().max(MAX_DOCUMENT_BYTES), style: textStyle, changeId: identifier.optional(), inlineImage: inlineImage.optional() }).strict()).min(1).max(20000),
}).strict()
const blockSchema: z.ZodType<DocumentBlock> = z.lazy(() => z.discriminatedUnion('type', [paragraph,
    z.object({ type: z.literal('image'), id: identifier, assetId: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/), alt: z.string().max(2000), width: z.number().positive().max(16384), height: z.number().positive().max(16384) }).strict(),
    z.object({ type: z.literal('table'), id: identifier, widths: z.array(z.number().positive().max(2000)).min(1).max(100), presentation: tablePresentation.optional(), rows: z.array(z.object({ id: identifier, keepTogether: z.boolean().optional(), repeatHeader: z.boolean().optional(), cells: z.array(z.object({ id: identifier, paragraphs: z.array(paragraph).max(1000), blocks: z.array(blockSchema).min(1).max(1000).optional(), presentation: cellPresentation.optional() }).strict().refine(cell => cell.blocks ? cell.paragraphs.length === 0 : cell.paragraphs.length > 0, 'Cells have exactly one content authority')).min(1).max(100) }).strict()).min(1).max(100) }).strict(),
    z.object({ type: z.literal('pageBreak'), id: identifier }).strict(),
  ]))
export const documentSchema = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(blockSchema).max(20000),
  changes: z.array(z.object({ id: identifier, kind: z.enum(['insertion', 'deletion', 'format', 'paragraphInsertion', 'paragraphDeletion', 'paragraphFormat', 'paragraphSplit', 'paragraphJoin']), authorId: z.number().int().nonnegative().optional(), authorName: z.string().max(200), createdAt: z.string().datetime(), status: z.enum(['pending', 'accepted', 'rejected']), origin: z.string().max(200).optional(), importedAuthor: z.string().max(200).optional(), targetRunIds: z.array(identifier).max(20000), targetBlockIds: z.array(identifier).max(20000).optional(), beforeStyle: textStyle.optional(), afterStyle: textStyle.optional(), beforeParagraphStyle: paragraphStyle.optional(), afterParagraphStyle: paragraphStyle.optional() }).strict()).max(10000),
  comments: z.array(z.object({ id: identifier, authorId: z.number().int().nonnegative().optional(), authorName: z.string().max(200), createdAt: z.string().datetime(), text: z.string().max(10000), anchors: z.array(z.object({ blockId: identifier, runId: identifier, start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), sourceText: z.string().max(20000) }).strict()).min(1).max(1000), resolved: z.boolean(), importedAuthor: z.string().max(200).optional() }).strict()).max(10000),
  layout: z.object({ columns: z.object({ count: z.number().int().min(1).max(6), gap: z.number().min(0).max(500) }).strict().optional(), preset: z.string().max(200).optional(), width: z.number().min(100).max(2000), height: z.number().min(100).max(3000), margins: z.tuple([z.number().nonnegative(), z.number().nonnegative(), z.number().nonnegative(), z.number().nonnegative()]), headerDistance: length.optional(), footerDistance: length.optional(), gutter: length.optional(), font: z.string().min(1).max(100), fontSize: z.number().min(6).max(144), pageNumbers: z.boolean(), header: z.array(paragraph).max(100), footer: z.array(paragraph).max(100) }).strict(),
}).strict()
function validateExchangeDocument(raw: unknown): WordDocument {
  const active = new Set<object>(); let count = 0
  const bounded = (value: unknown, depth: number): boolean => {
    if (depth > 96 || ++count > 500000) return false
    if (!value || typeof value !== 'object') return true
    if (active.has(value)) return false
    active.add(value); const valid = (Array.isArray(value) ? value : Object.values(value)).every((child: unknown) => bounded(child, depth + 1)); active.delete(value); return valid
  }
  if (!bounded(raw, 0)) throw new WordCodecError('DOCUMENT_NESTING_LIMIT', 'Document is cyclic or exceeds nesting/content bounds', 413)
  if (Buffer.byteLength(JSON.stringify(raw) ?? '') > MAX_DOCUMENT_BYTES) throw new WordCodecError('DOCUMENT_TOO_LARGE', 'Word exchange document exceeds 16 MiB', 413)
  const document = documentSchema.parse(raw)
  const validateUnicode = (value: unknown): void => {
    if (typeof value === 'string' && (value.includes(String.fromCharCode(0)) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value))) throw new Error('Exchange strings require valid Unicode without NUL. Original bytes must be preserved separately.')
    if (Array.isArray(value)) for (const item of value) validateUnicode(item)
    else if (value && typeof value === 'object') for (const item of Object.values(value)) validateUnicode(item)
  }
  validateUnicode(document)
  const ids = new Set<string>()
  const add = (id: string) => { if (ids.has(id)) throw new Error('Duplicate document identity'); ids.add(id) }
  const runs = new Map<string, { text: string; blockId: string }>()
  for (const block of allBlocks(document.blocks)) {
    if (block.type !== 'paragraph') add(block.id)
    if (block.type === 'table') {
      for (const row of block.rows) { add(row.id); if (row.cells.length !== block.widths.length) throw new Error('Table column count mismatch'); for (const cell of row.cells) add(cell.id) }
    }
  }
  for (const block of paragraphsOf(document, true)) {
    add(block.id)
    for (const run of block.runs) {
      add(run.id)
      if (run.inlineImage && (run.text !== '' || Object.keys(run.style).length)) throw new Error('Inline images require a protected empty text/style run')
      runs.set(run.id, { text: run.text, blockId: block.id })
    }
  }
  const paragraphIds = new Set(paragraphsOf(document, true).map((block) => block.id))
  const byParagraphId = new Map(paragraphsOf(document, true).map((block) => [block.id, block]))
  const adjacent = new Set<string>()
  const story = (paragraphs: Array<{ id: string }>) => { for (let index = 1; index < paragraphs.length; index++) adjacent.add(JSON.stringify([paragraphs[index - 1]!.id, paragraphs[index]!.id])) }
  // A page break, image, table or cell boundary cannot be a paragraph mark.
  const boundaries = (blocks: DocumentBlock[]) => { for (let index = 1; index < blocks.length; index++) { const left = blocks[index - 1]; const right = blocks[index]; if (left?.type === 'paragraph' && right?.type === 'paragraph') story([left, right]) } }
  boundaries(document.blocks)
  story(document.layout.header); story(document.layout.footer)
  for (const block of allBlocks(document.blocks)) if (block.type === 'table') for (const row of block.rows) for (const cell of row.cells) boundaries(cellBlocks(cell))
  const paragraphFormats = new Set<string>()
  for (const change of document.changes) {
    add(change.id); if (change.targetRunIds.some((id) => !runs.has(id)) || change.targetBlockIds?.some((id) => !paragraphIds.has(id))) throw new Error('Change target does not exist')
    if (new Set(change.targetRunIds).size !== change.targetRunIds.length || new Set(change.targetBlockIds).size !== (change.targetBlockIds?.length ?? 0)) throw new Error('Duplicate change target')
    if (change.kind.startsWith('paragraph') && (!change.targetBlockIds?.length || change.targetRunIds.length)) throw new Error('Paragraph revisions require paragraph targets')
    if (['paragraphInsertion', 'paragraphDeletion'].includes(change.kind) && change.status === 'pending' && change.targetBlockIds?.some((id) => paragraphsOf(document, true).find((block) => block.id === id)?.changeId !== change.id)) throw new Error('Pending paragraph review links cannot be discarded')
    if (change.kind === 'paragraphFormat') {
      if (!change.beforeParagraphStyle || !change.afterParagraphStyle) throw new Error('Paragraph formatting revisions require both property snapshots')
      for (const id of change.targetBlockIds!) {
        if (change.status === 'pending' && paragraphFormats.has(id)) throw new Error('Overlapping paragraph formatting revisions')
        if (change.status === 'pending') { paragraphFormats.add(id); if (exchangeDocument(byParagraphId.get(id)!.style) !== exchangeDocument(change.afterParagraphStyle)) throw new Error('Pending paragraph formatting differs from proposed properties') }
      }
    }
    if (change.kind === 'paragraphSplit' || change.kind === 'paragraphJoin') {
      const [left, right] = change.targetBlockIds!
      if (change.targetBlockIds!.length !== 2 || !adjacent.has(JSON.stringify([left, right])) || byParagraphId.get(left)!.boundaryChangeId !== change.id) throw new Error('Paragraph mark revisions require linked adjacent paragraphs in the same container')
    }
  }
  for (const block of paragraphsOf(document, true)) if (block.changeId && !document.changes.some((change) => change.id === block.changeId && ['paragraphInsertion', 'paragraphDeletion'].includes(change.kind) && change.targetBlockIds?.includes(block.id))) throw new Error('Missing paragraph change')
  for (const block of paragraphsOf(document, true)) if (block.boundaryChangeId && !document.changes.some((change) => change.id === block.boundaryChangeId && (change.kind === 'paragraphSplit' || change.kind === 'paragraphJoin') && change.targetBlockIds?.[0] === block.id)) throw new Error('Missing paragraph mark change')
  for (const block of paragraphsOf(document, true)) for (const run of block.runs) {
    if (run.changeId && !document.changes.some((change) => change.id === run.changeId && change.targetRunIds.includes(run.id))) throw new Error('Missing run change')
  }
  for (const comment of document.comments) {
    add(comment.id)
    for (const anchor of comment.anchors) {
      const run = runs.get(anchor.runId)
      if (!run || run.blockId !== anchor.blockId || anchor.end < anchor.start || anchor.end > run.text.length || run.text.slice(anchor.start, anchor.end) !== anchor.sourceText) throw new Error('Comment anchor is stale')
    }
  }
  const { width, height, margins } = document.layout
  if (margins[1] + margins[3] >= width || margins[0] + margins[2] >= height) throw new Error('Page margins leave no content area')
  return document
}
export function validateDocument(raw: unknown): WordDocument {
  try { return validateExchangeDocument(raw) }
  catch (error) {
    if (error instanceof WordCodecError) throw error
    throw new WordCodecError('DOCUMENT_INVALID', error instanceof z.ZodError ? 'Invalid canonical document schema.' : error instanceof Error ? error.message : 'Invalid canonical document.', 422)
  }
}
