import test from 'node:test'
import assert from 'node:assert/strict'
import { exportDocx, importDocx, exportDocxSections, validateDocxPackage, createZipBuffer, documentSchema, defaultLayout, type WordDocument } from '../src/index'

function document(): WordDocument {
  return { schemaVersion: 1, layout: { ...defaultLayout(), pageNumbers: false }, blocks: [{ type: 'paragraph', id: 'paragraph', style: {}, runs: [
    { id: 'retained', text: 'Bell 🔔 é ', style: { font: 'Georgia', bold: true } },
    { id: 'deleted', text: 'before', style: {}, changeId: 'delete' },
    { id: 'inserted', text: 'after', style: {}, changeId: 'insert' }
  ] }], changes: [
    { id: 'delete', kind: 'deletion', authorName: 'Reviewer', createdAt: '2026-10-10T00:00:00Z', status: 'pending', targetRunIds: ['deleted'] },
    { id: 'insert', kind: 'insertion', authorName: 'Reviewer', createdAt: '2026-10-10T00:00:00Z', status: 'pending', targetRunIds: ['inserted'] }
  ], comments: [{ id: 'comment', authorName: 'Reviewer', createdAt: '2026-10-10T00:00:00Z', text: 'Keep the clue.', resolved: false, anchors: [{ blockId: 'paragraph', runId: 'retained', start: 0, end: 4, sourceText: 'Bell' }] }] }
}
void test('headless export returns bytes and reimports native Word review without changing its input', async () => {
  const original = document(); const before = structuredClone(original)
  const bytes = await exportDocx(original, 'retain-review'); assert.ok(Buffer.isBuffer(bytes))
  const imported = await importDocx(bytes)
  assert.equal(imported.document.changes.filter(change => change.kind === 'insertion').length, 1)
  assert.equal(imported.document.changes.filter(change => change.kind === 'deletion').length, 1)
  assert.equal(imported.document.comments[0]?.text, 'Keep the clue.')
  assert.equal(imported.document.changes[0]?.importedAuthor, 'Reviewer')
  assert.deepEqual(original, before)
  const native = (await validateDocxPackage(bytes)).get('word/document.xml')?.toString('utf8') ?? ''
  assert.match(native, /w:ins/u); assert.match(native, /w:del/u); assert.match(native, /commentRangeStart/u); assert.match(native, /Bell/u); assert.match(native, /🔔 é/u)
})
void test('Original and Final projections do not mutate or decide pending review', async () => {
  const original = document(); const before = structuredClone(original)
  for (const mode of ['original', 'final'] satisfies Array<'original' | 'final'>) {
    const parts = await validateDocxPackage(await exportDocx(original, mode)); const xml = parts.get('word/document.xml')?.toString('utf8') ?? ''
    assert.doesNotMatch(xml, /<w:(?:ins|del)[ >]/u)
    assert.match(xml, mode === 'original' ? /before/u : /after/u)
    assert.doesNotMatch(xml, mode === 'original' ? />after</u : />before</u)
  }
  assert.deepEqual(original, before)
})
void test('native run and paragraph formatting revisions survive import', async () => {
  const value = document(); value.comments = []; value.changes = []
  const paragraph = value.blocks[0]; assert.ok(paragraph?.type === 'paragraph')
  paragraph.runs = [{ id: 'formatted', text: 'Mechanic', style: { bold: true } }]
  paragraph.style = { alignment: 'center' }
  value.changes.push({ id: 'run-format', kind: 'format', authorName: 'Reviewer', createdAt: '2026-10-10T00:00:00Z', status: 'pending', targetRunIds: ['formatted'], beforeStyle: { bold: false }, afterStyle: { bold: true } })
  value.changes.push({ id: 'paragraph-format', kind: 'paragraphFormat', authorName: 'Reviewer', createdAt: '2026-10-10T00:00:00Z', status: 'pending', targetRunIds: [], targetBlockIds: ['paragraph'], beforeParagraphStyle: { alignment: 'left' }, afterParagraphStyle: { alignment: 'center' } })
  const result = await importDocx(await exportDocx(value, 'retain-review'))
  assert.equal(result.document.changes.filter(change => change.kind === 'format').length, 1)
  assert.equal(result.document.changes.filter(change => change.kind === 'paragraphFormat').length, 1)
})
void test('independent sections retain landscape geometry, review and independent stories', async () => {
  const first = document(); const second = document(); second.layout.width = 1123; second.layout.height = 794
  second.layout.header = [{ type: 'paragraph', id: 'heading', style: {}, runs: [{ id: 'heading-run', text: 'Map plate', style: {} }] }]
  const bytes = await exportDocxSections({ sections: [{ title: '', suppressTitle: true, document: first }, { title: '', suppressTitle: true, startsSection: true, document: second }], assets: new Map() }, 'retain-review')
  const result = await importDocx(bytes)
  assert.equal(result.sections.length, 2); assert.equal(result.document.comments.length, 2)
  assert.equal(result.sections[1]?.document.layout.width, 1123)
  assert.equal(result.sections[1]?.document.layout.header[0]?.runs[0]?.text, 'Map plate')
})
void test('unsafe archives, XML and external resources are rejected before conversion', async () => {
  await assert.rejects(importDocx(Buffer.from('not ZIP')))
  const bytes = await exportDocx(document(), 'retain-review'); const files = await validateDocxPackage(bytes)
  files.set('word/document.xml', Buffer.from('<!DOCTYPE w:document [<!ENTITY x SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'))
  await assert.rejects(importDocx(await createZipBuffer(Array.from(files, ([name, content]) => ({ name, content })))))
  const other = await validateDocxPackage(bytes)
  other.set('word/_rels/document.xml.rels', Buffer.from('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="remote" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="http://127.0.0.1/private" TargetMode="External"/></Relationships>'))
  await assert.rejects(importDocx(await createZipBuffer(Array.from(other, ([name, content]) => ({ name, content })))))
})
void test('unknown JSON is validated before export authority', () => {
  const input: unknown = { ...document(), hiddenAuthority: 'network' }
  assert.equal(documentSchema.safeParse(input).success, false)
})

void test('two-column prose and single-column landscape plates retain independent section layouts', async () => {
  const first = document(); first.layout.columns = { count: 2, gap: 28 }
  const second = document(); second.layout.width = 1123; second.layout.height = 794; second.layout.columns = { count: 1, gap: 0 }
  const input = { sections: [{ title: '', suppressTitle: true, document: first }, { title: '', suppressTitle: true, startsSection: true, document: second }], assets: new Map() }
  const before = structuredClone(input)
  const result = await importDocx(await exportDocxSections(input, 'retain-review'))
  assert.deepEqual(result.sections[0]?.document.layout.columns, { count: 2, gap: 28 })
  assert.deepEqual(result.sections[1]?.document.layout.columns, { count: 1, gap: 0 })
  assert.equal(result.sections[1]?.document.layout.width, 1123)
  assert.equal(result.losses.some(loss => loss.code === 'MULTI_COLUMN_LAYOUT'), false)
  assert.deepEqual(input, before)
})
