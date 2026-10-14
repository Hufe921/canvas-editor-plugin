import test from 'node:test'
import assert from 'node:assert/strict'
import { importDocx, exportDocx, exportDocxSections, createZipBuffer, validateDocxPackage, defaultLayout, paragraphsOf, type WordDocument } from '../src/index'
import { validateDocument } from '../src/validation'

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
/** Independently authored source OOXML, not the serializer under test. */
async function source(body: string, styles = '', extra: Array<{name: string; content: string}> = []): Promise<Buffer> {
  return createZipBuffer([
    { name: '[Content_Types].xml', content: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="root" Type="${relationships}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', content: `<w:document xmlns:w="${w}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>` },
    ...(styles ? [{ name: 'word/styles.xml', content: `<w:styles xmlns:w="${w}">${styles}</w:styles>` }] : []), ...extra
  ])
}
void test('independent superscript, small caps and custom tabs retain explicit and inherited properties on reopen', async () => {
  const imported = await importDocx(await source('<w:p><w:pPr><w:pStyle w:val="Caption"/><w:tabs><w:tab w:val="clear" w:pos="720"/><w:tab w:val="decimal" w:pos="1440" w:leader="dot"/><w:tab w:val="bar" w:pos="2160"/></w:tabs></w:pPr><w:r><w:rPr><w:rStyle w:val="Reference"/><w:vertAlign w:val="superscript"/><w:smallCaps/></w:rPr><w:t>Clue</w:t><w:tab/><w:t>12.5</w:t></w:r><w:r><w:rPr><w:vertAlign w:val="baseline"/><w:smallCaps w:val="0"/><w:caps w:val="0"/></w:rPr><w:t> unchanged</w:t></w:r></w:p><w:p><w:r><w:rPr><w:vertAlign w:val="subscript"/><w:caps/></w:rPr><w:t>2</w:t></w:r></w:p>', '<w:docDefaults><w:rPrDefault><w:rPr><w:smallCaps/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Caption"><w:pPr><w:tabs><w:tab w:val="right" w:pos="720" w:leader="hyphen"/></w:tabs></w:pPr></w:style><w:style w:type="character" w:styleId="Reference"><w:rPr><w:vertAlign w:val="superscript"/><w:smallCaps/></w:rPr></w:style>'))
  assert.deepEqual(imported.losses, [])
  const paragraph = paragraphsOf(imported.document)[0]; assert.ok(paragraph)
  assert.deepEqual(paragraph.style.tabs, [{ alignment: 'clear', position: 48 }, { alignment: 'decimal', position: 96, leader: 'dot' }, { alignment: 'bar', position: 144 }])
  assert.equal(paragraph.runs[0]?.style.verticalAlignment, 'superscript'); assert.equal(paragraph.runs[0]?.style.smallCaps, true)
  assert.equal(paragraph.runs[1]?.style.verticalAlignment, 'baseline'); assert.equal(paragraph.runs[1]?.style.smallCaps, false); assert.equal(paragraph.runs[1]?.style.allCaps, false)
  assert.equal(imported.document.defaults?.run.smallCaps, true)
  const definitions = Object.values(imported.styleDefinitions)
  assert.ok(definitions.some(style => style.kind === 'character' && style.run.verticalAlignment === 'superscript' && style.run.smallCaps))
  assert.ok(definitions.some(style => style.paragraph.tabs?.[0]?.position === 48 && style.paragraph.tabs[0].alignment === 'right'))
  const before = structuredClone(imported)
  const bytes = await exportDocxSections({ sections: imported.sections.map(section => ({ title: '', suppressTitle: true, breakAfter: section.breakAfter, document: section.document })), styleDefinitions: imported.styleDefinitions, assets: new Map() }, 'retain-review')
  const reopened = await importDocx(bytes); assert.deepEqual(reopened.losses, [])
  const after = paragraphsOf(reopened.document)[0]; assert.ok(after)
  assert.deepEqual(after.style.tabs, paragraph.style.tabs); assert.deepEqual(after.runs.map(run => run.style), paragraph.runs.map(run => run.style)); assert.equal(after.runs.map(run => run.text).join(''), 'Clue\t12.5 unchanged')
  assert.equal(paragraphsOf(reopened.document)[1]?.runs[0]?.style.verticalAlignment, 'subscript')
  const xml = (await validateDocxPackage(bytes)).get('word/document.xml')?.toString('utf8') ?? ''
  assert.match(xml, /<w:vertAlign w:val="superscript"\/>/u); assert.match(xml, /<w:smallCaps w:val="0"\/>/u); assert.match(xml, /<w:tab w:val="decimal" w:pos="1440" w:leader="dot"\/>/u)
  assert.deepEqual(imported, before)
})
void test('unsupported properties and malformed tab stops produce explicit import losses instead of clean conversion claims', async () => {
  const imported = await importDocx(await source('<w:p><w:pPr><w:tabs><w:tab w:val="start" w:pos="720"/><w:tab w:val="left" w:pos="invalid"/><w:tab w:val="right" w:pos="1440" w:leader="unsupported"/></w:tabs><w:textAlignment w:val="center"/></w:pPr><w:r><w:rPr><w:vertAlign w:val="unsupported"/><w:smallCaps w:val="invalid"/><w:position w:val="6"/><w:emboss/></w:rPr><w:t>Text remains intact.</w:t></w:r></w:p>'))
  assert.equal(paragraphsOf(imported.document)[0]?.runs[0]?.text, 'Text remains intact.')
  for (const code of ['SOURCE_TAB_STOP_UNSUPPORTED', 'SOURCE_RUN_VERTICAL_ALIGNMENT', 'SOURCE_RUN_TOGGLE_UNSUPPORTED', 'SOURCE_RUN_PROPERTY_UNSUPPORTED', 'SOURCE_PARAGRAPH_PROPERTY_UNSUPPORTED']) assert.ok(imported.losses.some(loss => loss.code === code), code)
})
function document(): WordDocument {
  return { schemaVersion: 1, layout: { ...defaultLayout(), pageNumbers: false }, blocks: [{ type: 'paragraph', id: 'p', style: {}, runs: [{ id: 'r', text: 'Mechanic', style: {} }] }], changes: [], comments: [] }
}
const revision = { id: 'review', authorName: 'Reviewer', createdAt: '2026-10-14T00:00:00Z', status: 'pending' as const, targetRunIds: ['r'] }
void test('pending insertion/deletion require nonempty matching run links before validation or any export projection', async () => {
  for (const container of ['body', 'header', 'cell'] as const) for (const kind of ['insertion', 'deletion'] as const) {
    const input = document(); input.changes.push({ ...revision, kind }); const before = structuredClone(input)
    const paragraph = input.blocks[0]; assert.ok(paragraph?.type === 'paragraph')
    if (container === 'header') { input.blocks = []; input.layout.header = [paragraph] }
    if (container === 'cell') input.blocks = [{ type: 'table', id: 'table', widths: [100], rows: [{ id: 'row', cells: [{ id: 'cell', paragraphs: [paragraph] }] }] }]
    const retained = structuredClone(input)
    assert.throws(() => validateDocument(input), /pending.*(?:link|reference)|linked/i)
    for (const mode of ['retain-review', 'original', 'final'] as const) await assert.rejects(exportDocx(input, mode), /pending.*(?:link|reference)|linked/i)
    assert.deepEqual(input, retained); assert.equal(before.changes[0]?.kind, kind)
    paragraph.runs[0].changeId = 'wrong'
    assert.throws(() => validateDocument(input), /pending.*(?:link|reference)|linked/i)
    paragraph.runs[0].changeId = revision.id; assert.doesNotThrow(() => validateDocument(input))
    const change = input.changes[0]; assert.ok(change); change.targetRunIds = []; assert.throws(() => validateDocument(input), /target/i)
  }
})
void test('format revisions require both snapshots, matching current properties and exactly one pending format per target', async () => {
  const input = document(); input.changes.push({ ...revision, kind: 'format' })
  assert.throws(() => validateDocument(input), /snapshots/i); await assert.rejects(exportDocx(input, 'retain-review'), /snapshots/i)
  const change = input.changes[0]; assert.ok(change); change.beforeStyle = {}; assert.throws(() => validateDocument(input), /snapshots/i); change.afterStyle = { bold: true }; assert.throws(() => validateDocument(input), /proposed|properties/i)
  change.afterStyle = {}; assert.doesNotThrow(() => validateDocument(input)); const paragraph = input.blocks[0]; assert.ok(paragraph?.type === 'paragraph'); paragraph.runs[0].changeId = revision.id
  assert.throws(() => validateDocument(input), /run.*change|insertion.*deletion/i); delete paragraph.runs[0].changeId
  input.changes.push({ ...change, id: 'second-format' }); assert.throws(() => validateDocument(input), /overlapping/i)
  input.changes.pop(); change.targetRunIds = []; assert.throws(() => validateDocument(input), /target/i)
})
void test('complete native formatting snapshots preserve superscript/small caps and tab revisions in Markup, Original and Final', async () => {
  const imported = await importDocx(await source('<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="1440" w:leader="dot"/></w:tabs><w:pPrChange w:id="1" w:author="Reviewer" w:date="2026-10-14T00:00:00Z"><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr></w:pPrChange></w:pPr><w:r><w:rPr><w:smallCaps/><w:vertAlign w:val="superscript"/><w:rPrChange w:id="2" w:author="Reviewer" w:date="2026-10-14T00:00:00Z"><w:rPr><w:smallCaps w:val="0"/><w:vertAlign w:val="baseline"/></w:rPr></w:rPrChange></w:rPr><w:t>Clue\t12</w:t></w:r></w:p>'))
  assert.deepEqual(imported.losses, []); const before = structuredClone(imported.document)
  const format = imported.document.changes.find(change => change.kind === 'format'); assert.ok(format); assert.equal(format.beforeStyle?.verticalAlignment, 'baseline'); assert.equal(format.afterStyle?.smallCaps, true)
  for (const mode of ['retain-review', 'original', 'final'] as const) {
    const reopened = await importDocx(await exportDocx(imported.document, mode)); const paragraph = paragraphsOf(reopened.document)[0]; assert.ok(paragraph)
    assert.equal(paragraph.runs[0]?.style.verticalAlignment, mode === 'original' ? 'baseline' : 'superscript'); assert.equal(paragraph.runs[0]?.style.smallCaps, mode !== 'original')
    assert.equal(paragraph.style.tabs?.[0]?.position, mode === 'original' ? 48 : 96); assert.equal(reopened.document.changes.length, mode === 'retain-review' ? 2 : 0)
  }
  assert.deepEqual(imported.document, before)
})
void test('native formatting revisions without an explicit previous snapshot are rejected rather than filled with an empty style', async () => {
  for (const properties of ['rPr', 'pPr'] as const) {
    const current = `<w:${properties}><w:${properties}Change w:id="1" w:author="Reviewer" w:date="2026-10-14T00:00:00Z"/></w:${properties}>`
    const body = properties === 'rPr' ? `<w:p><w:r>${current}<w:t>Mechanic</w:t></w:r></w:p>` : `<w:p>${current}<w:r><w:t>Mechanic</w:t></w:r></w:p>`
    await assert.rejects(importDocx(await source(body)), /explicit previous property snapshot/i)
  }
})
void test('missing paragraph formatting snapshots are rejected for pending and decided records', () => {
  for (const status of ['pending', 'accepted', 'rejected'] as const) {
    const input = document(); input.changes.push({ ...revision, status, kind: 'paragraphFormat', targetRunIds: [], targetBlockIds: ['p'] })
    assert.throws(() => validateDocument(input), /snapshots/i)
    const change = input.changes[0]; assert.ok(change); change.beforeParagraphStyle = {}; assert.throws(() => validateDocument(input), /snapshots/i); change.afterParagraphStyle = {}; assert.doesNotThrow(() => validateDocument(input))
  }
})
void test('decided run formats also require explicit snapshots; an explicit empty previous style is valid', () => {
  for (const status of ['accepted', 'rejected'] as const) {
    const input = document(); input.changes.push({ ...revision, status, kind: 'format' }); assert.throws(() => validateDocument(input), /snapshots/i)
    const change = input.changes[0]; assert.ok(change); change.afterStyle = {}; assert.throws(() => validateDocument(input), /snapshots/i); change.beforeStyle = {}; assert.doesNotThrow(() => validateDocument(input))
  }
})
void test('tab limits, duplicate positions and default/numbering intervals never silently qualify as supported', async () => {
  const tabs = '<w:tab w:val="left" w:pos="-720" w:leader="none"/>' + '<w:tab w:val="right" w:pos="-720"/>' + Array.from({length:129},(_,index)=>`<w:tab w:val="left" w:pos="${index*100}"/>`).join('')
  const imported = await importDocx(await source(`<w:p><w:pPr><w:tabs>${tabs}</w:tabs></w:pPr><w:r><w:t>Bounded tabs.</w:t></w:r></w:p>`, '', [{name:'word/settings.xml',content:`<w:settings xmlns:w="${w}"><w:defaultTabStop w:val="960"/></w:settings>`},{name:'word/numbering.xml',content:`<w:numbering xmlns:w="${w}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="1440"/></w:tabs></w:pPr></w:lvl></w:abstractNum></w:numbering>`}]))
  for (const code of ['SOURCE_TAB_STOP_LIMIT', 'SOURCE_TAB_STOP_DUPLICATE', 'SOURCE_DEFAULT_TAB_STOP', 'SOURCE_NUMBERING_TABS']) assert.ok(imported.losses.some(loss=>loss.code===code), code)
  assert.equal(paragraphsOf(imported.document)[0]?.style.tabs?.[0]?.position, -48)
  const input = document(); const paragraph = input.blocks[0]; assert.ok(paragraph?.type === 'paragraph')
  paragraph.style.tabs = [{alignment:'left',position:48},{alignment:'right',position:48}]; assert.throws(()=>validateDocument(input), /schema/i)
  paragraph.style.tabs = [{alignment:'left',position:0.01}]; assert.throws(()=>validateDocument(input), /schema/i)
})
void test('property loss diagnostics distinguish supported paragraph insertion and boundary marks from unsupported formatting', async () => {
  for (const kind of ['paragraphInsertion', 'paragraphSplit'] as const) {
    const input = document(); const left = input.blocks[0]; assert.ok(left?.type === 'paragraph')
    if (kind === 'paragraphInsertion') { left.changeId = revision.id; input.changes.push({ ...revision, kind, targetRunIds: [], targetBlockIds: ['p'] }) }
    else { left.boundaryChangeId = revision.id; input.blocks.push({type:'paragraph',id:'right',style:{},runs:[{id:'right-run',text:'Continued.',style:{}}]}); input.changes.push({...revision,kind,targetRunIds:[],targetBlockIds:['p','right']}) }
    const reopened = await importDocx(await exportDocx(input,'retain-review')); assert.deepEqual(reopened.losses,[]); assert.ok(reopened.document.changes.some(change=>change.kind===kind))
  }
})
