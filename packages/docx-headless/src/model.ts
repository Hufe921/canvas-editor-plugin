/** Neutral Word exchange AST; no book, scene, database, auth, persistence or inference authority. */
export const MAX_DOCUMENT_BYTES=16*1024*1024
export type DocumentView='final'|'original'|'markup';
export interface TextStyle {
  characterStyleId?: string;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeout?: boolean;
  color?: string;
  highlight?: string;
  hyperlink?: string;
}
export interface ParagraphStyle {
  name?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineSpacing?: number;
  before?: number;
  after?: number;
  indent?: number;
  firstLineIndent?: number;
  keepWithNext?: boolean;
  pageBreakBefore?: boolean;
  heading?: 1 | 2 | 3 | 4 | 5 | 6;
  list?: 'bullet' | 'number';
}
export interface DocumentRun {
  id: string;
  text: string;
  style: TextStyle;
  changeId?: string;
  inlineImage?: Omit<DocumentImage, 'type' | 'id'>;
}
export interface DocumentParagraph {
  type: 'paragraph';
  id: string;
  style: ParagraphStyle;
  runs: DocumentRun[];
  changeId?: string;
  /** Review of the paragraph mark following this physical paragraph. */
  boundaryChangeId?: string;
}
export interface DocumentImage {
  type: 'image';
  id: string;
  assetId: number;
  sha256: string;
  alt: string;
  width: number;
  height: number;
}
export interface DocumentTable {
  type: 'table';
  id: string;
  widths: number[];
  rows: Array<{ id: string; cells: Array<{ id: string; paragraphs: DocumentParagraph[] }> }>;
}
export interface DocumentBreak { type: 'pageBreak'; id: string }
export type DocumentBlock = DocumentParagraph | DocumentImage | DocumentTable | DocumentBreak;
export interface DocumentAnchor {
  blockId: string;
  runId: string;
  start: number;
  end: number;
  sourceText: string;
}
export interface DocumentChange {
  id: string;
  kind: 'insertion' | 'deletion' | 'format' | 'paragraphInsertion' | 'paragraphDeletion' | 'paragraphFormat' | 'paragraphSplit' | 'paragraphJoin';
  authorId?: number;
  authorName: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  origin?: string;
  importedAuthor?: string;
  targetRunIds: string[];
  targetBlockIds?: string[];
  beforeStyle?: TextStyle;
  afterStyle?: TextStyle;
  beforeParagraphStyle?: ParagraphStyle;
  afterParagraphStyle?: ParagraphStyle;
}
export interface DocumentComment {
  id: string;
  authorId?: number;
  authorName: string;
  createdAt: string;
  text: string;
  anchors: DocumentAnchor[];
  resolved: boolean;
  importedAuthor?: string;
}
export interface DocumentLayout {
  preset?: string;
  columns?: { count: number; gap: number };
  width: number;
  height: number;
  margins: [number, number, number, number];
  font: string;
  fontSize: number;
  pageNumbers: boolean;
  header: DocumentParagraph[];
  footer: DocumentParagraph[];
}
export interface WordDocument {
  schemaVersion: 1;
  blocks: DocumentBlock[];
  changes: DocumentChange[];
  comments: DocumentComment[];
  layout: DocumentLayout;
}
export const defaultLayout = (): DocumentLayout => ({
  preset: 'manuscript', width: 794, height: 1123, margins: [76, 76, 76, 76],
  font: 'Georgia', fontSize: 16, pageNumbers: true, header: [], footer: [],
})
export function paragraphsOf(document: WordDocument, includeStories = false): DocumentParagraph[] {
  const body = document.blocks.flatMap((block) => block.type === 'paragraph' ? [block]
    : block.type === 'table' ? block.rows.flatMap((row) => row.cells.flatMap((cell) => cell.paragraphs)) : [])
  return includeStories ? [...document.layout.header, ...body, ...document.layout.footer] : body
}
export function visibleParagraph(block: DocumentParagraph, changes: DocumentChange[], view: DocumentView): boolean {
  const change = changes.find((item) => item.id === block.changeId)
  if (!change || !['paragraphInsertion', 'paragraphDeletion'].includes(change.kind)) return true
  const insertion = change.kind === 'paragraphInsertion'
  if (change.status === 'accepted') return insertion
  if (change.status === 'rejected') return !insertion
  return view === 'markup' || (view === 'original' ? !insertion : insertion)
}
export function paragraphStyle(block: DocumentParagraph, changes: DocumentChange[], view: DocumentView): ParagraphStyle {
  const change = changes.find((item) => item.kind === 'paragraphFormat' && item.targetBlockIds?.includes(block.id) && item.status === 'pending')
  return change && view === 'original' ? change.beforeParagraphStyle ?? block.style : block.style
}
/** Physical identities remain stable even when a projected paragraph mark is absent. */
export function paragraphBoundaryVisible(left: DocumentParagraph, right: DocumentParagraph, changes: DocumentChange[], view: DocumentView): boolean {
  const change = changes.find((item) => item.id === left.boundaryChangeId && (item.kind === 'paragraphSplit' || item.kind === 'paragraphJoin') && item.targetBlockIds?.[0] === left.id && item.targetBlockIds?.[1] === right.id)
  if (!change) return true
  const split = change.kind === 'paragraphSplit'
  if (change.status === 'accepted') return split
  if (change.status === 'rejected') return !split
  return view === 'markup' || (view === 'original' ? !split : split)
}
export function paragraphGroups(paragraphs: DocumentParagraph[], changes: DocumentChange[], view: DocumentView): DocumentParagraph[][] {
  const result: DocumentParagraph[][] = []
  for (const block of paragraphs.filter((item) => visibleParagraph(item, changes, view))) {
    const previous = result.at(-1)?.at(-1)
    if (previous && !paragraphBoundaryVisible(previous, block, changes, view)) result[result.length - 1]!.push(block)
    else result.push([block])
  }
  return result
}
export function visibleRun(run: DocumentRun, changes: DocumentChange[], view: DocumentView): boolean {
  const change = changes.find((item) => item.id === run.changeId)
  if (!change || change.kind === 'format') return true
  if (change.status === 'accepted') return change.kind === 'insertion'
  if (change.status === 'rejected') return change.kind === 'deletion'
  return view === 'markup' || (view === 'original' ? change.kind === 'deletion' : change.kind === 'insertion')
}
export function runStyle(run: DocumentRun, changes: DocumentChange[], view: DocumentView): TextStyle {
  const change = changes.find((item) => item.kind === 'format' && item.targetRunIds.includes(run.id) && item.status === 'pending')
  return change && view === 'original' ? change.beforeStyle ?? run.style : run.style
}

export function logicalParagraphs(paragraphs:DocumentParagraph[],changes:DocumentChange[],view:DocumentView):DocumentParagraph[]{return paragraphGroups(paragraphs,changes,view).map((group)=>({...group[0],style:paragraphStyle(group[0],changes,view),runs:group.flatMap((block)=>block.runs)}))}
export function exchangeDocument(value:unknown):string{const normalize=(item:unknown):unknown=>Array.isArray(item)?item.map(normalize):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).filter(([,child])=>child!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,child])=>[key,normalize(child)])):item;return JSON.stringify(normalize(value))}
