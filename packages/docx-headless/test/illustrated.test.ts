import test from 'node:test'
import assert from 'node:assert/strict'
import { allBlocks, paragraphsOf, cellBlocks, importDocx, exportDocx, exportDocxSections, createZipBuffer, validateDocxPackage, defaultLayout, documentSchema, namespaceDocument, type WordDocument } from '../src/index'
import { validateDocument } from '../src/validation'

/** Independent OOXML fixture. It is not emitted by the codec under test. */
async function source(): Promise<Buffer> {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const border = '<w:left w:val="single" w:color="286573" w:sz="6" w:space="7"/>'
  const margins = '<w:top w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/>'
  const nested = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="1800"/><w:gridCol w:w="1800"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr><w:tc><w:tcPr><w:tcW w:w="1800" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:r><w:t>Clue</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="1800" w:type="dxa"/></w:tcPr><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>DC 12</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p></w:tc></w:tr></w:tbl>`
  const panel = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>${border}</w:tblBorders><w:shd w:val="clear" w:fill="EDF2F2"/><w:tblLayout w:type="fixed"/><w:tblCellMar>${margins}</w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="4200"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="4200" w:type="dxa"/><w:shd w:val="clear" w:fill="EDF2F2"/><w:tcMar>${margins}</w:tcMar></w:tcPr><w:p><w:pPr><w:keepLines/><w:widowControl/><w:pBdr>${border}</w:pBdr><w:spacing w:line="240" w:lineRule="atLeast"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:sz w:val="22"/></w:rPr><w:t>A bell rings. 🔔 é</w:t></w:r></w:p>${nested}<w:p/></w:tc></w:tr></w:tbl>`
  const section = (landscape: boolean) => `<w:sectPr><w:headerReference w:type="default" r:id="header"/><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="${landscape?15840:12240}" w:h="${landscape?12240:15840}"${landscape?' w:orient="landscape"':''}/><w:pgMar w:top="1000" w:right="1080" w:bottom="1000" w:left="1080" w:header="420" w:footer="390" w:gutter="0"/><w:cols w:num="${landscape?1:2}" w:space="420" w:equalWidth="1"/></w:sectPr>`
  const image = '<w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Map" descr="Synthetic map"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="map"/></pic:blipFill><pic:spPr><a:xfrm><a:ext cx="914400" cy="914400"/></a:xfrm></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  return createZipBuffer([
    { name: '[Content_Types].xml', content: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', content: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="root" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/document.xml', content: `<w:document xmlns:w="${w}" xmlns:r="${r}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:r><w:t>Two-column prose.</w:t></w:r><w:ins w:id="1" w:author="Reviewer" w:date="2026-10-13T00:00:00Z"><w:r><w:t>Pending clue.</w:t></w:r></w:ins></w:p>${panel}<w:p><w:pPr>${section(false)}</w:pPr></w:p><w:p>${image}</w:p><w:p><w:r><w:t>Landscape map plate.</w:t></w:r></w:p>${section(true)}</w:body></w:document>` },
    { name: 'word/_rels/document.xml.rels', content: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header" Type="${r}/header" Target="header.xml"/><Relationship Id="footer" Type="${r}/footer" Target="footer.xml"/><Relationship Id="comments" Type="${r}/comments" Target="comments.xml"/><Relationship Id="map" Type="${r}/image" Target="media/map.png"/></Relationships>` },
    { name: 'word/header.xml', content: `<w:hdr xmlns:w="${w}"><w:p><w:r><w:t>Adventure header</w:t></w:r></w:p></w:hdr>` },
    { name: 'word/footer.xml', content: `<w:ftr xmlns:w="${w}"><w:p><w:r><w:t>Adventure footer</w:t></w:r></w:p></w:ftr>` },
    { name: 'word/comments.xml', content: `<w:comments xmlns:w="${w}"><w:comment w:id="0" w:author="Reviewer" w:date="2026-10-13T00:00:00Z"><w:p><w:r><w:t>Keep the DC.</w:t></w:r></w:p></w:comment></w:comments>` },
    { name: 'word/media/map.png', content: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR9sAAAAASUVORK5CYII=', 'base64') }
  ])
}

void test('independent illustrated OOXML retains nested cells, decoration, sections, comments and pending changes', async () => {
  const imported = await importDocx(await source())
  assert.deepEqual(imported.losses, [])
  assert.equal(imported.sections.length, 2)
  const first = imported.sections[0]; const second = imported.sections[1]; assert.ok(first); assert.ok(second)
  assert.equal(first.document.layout.columns?.count, 2); assert.equal(second.document.layout.columns?.count, 1)
  assert.ok(second.document.layout.width > second.document.layout.height)
  assert.equal(first.document.layout.headerDistance, 28); assert.equal(first.document.layout.footerDistance, 26)
  const panel = first.document.blocks.find(block => block.type === 'table'); assert.ok(panel && panel.type === 'table')
  assert.equal(panel.presentation?.shading, '#edf2f2'); assert.equal(panel.presentation?.alignment, 'center'); assert.equal(panel.rows[0]?.keepTogether, true)
  const inner = allBlocks(panel.rows.flatMap(row => row.cells.flatMap(cellBlocks))).find(block => block.type === 'table'); assert.ok(inner && inner.type === 'table')
  assert.equal(inner.rows[0]?.repeatHeader, true); assert.equal(inner.rows[0]?.cells[0]?.presentation?.verticalAlignment, 'center')
  const prose = paragraphsOf(first.document).find(paragraph => paragraph.runs.some(run => run.text.includes('bell rings'))); assert.ok(prose)
  assert.equal(prose.style.lineRule, 'atLeast'); assert.equal(prose.style.lineSpacing, 16); assert.equal(prose.style.keepTogether, true)
  assert.equal(prose.style.borders?.left?.width, 0.75); assert.equal(prose.runs[0]?.style.font, 'Georgia')
  assert.equal(imported.document.comments[0]?.anchors[0]?.sourceText, 'DC 12'); assert.equal(imported.document.changes[0]?.kind, 'insertion')
  const before = structuredClone(imported)
  const assets = new Map(imported.assets.map(asset => [asset.placeholderId, { bytes: Buffer.from(asset.bytesBase64, 'base64'), mediaType: asset.mediaType }]))
  const output = await exportDocxSections({ sections: imported.sections.map(section => ({ title: '', suppressTitle: true, breakAfter: section.breakAfter, document: section.document, stories: section.stories })), assets, styleDefinitions: imported.styleDefinitions }, 'retain-review')
  assert.deepEqual(imported, before)
  const reopened = await importDocx(output); assert.deepEqual(reopened.losses, [])
  assert.equal(reopened.document.comments[0]?.text, 'Keep the DC.'); assert.equal(reopened.document.comments[0]?.anchors[0]?.sourceText, 'DC 12')
  assert.equal(reopened.document.changes.filter(change => change.kind === 'insertion').length, 1)
  assert.equal(allBlocks(reopened.document.blocks).filter(block => block.type === 'table').length, 2)
  assert.equal(paragraphsOf(reopened.document).length, paragraphsOf(imported.document).length)
  assert.deepEqual(reopened.assets.map(asset => asset.sha256), imported.assets.map(asset => asset.sha256))
  const namespaced = namespaceDocument(first.document, 'example'); const ids = allBlocks(namespaced.blocks).map(block => block.id)
  assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => /^[a-f0-9]{64}$/.test(id)))
  const files = await validateDocxPackage(output)
  const xml = files.get('word/document.xml')?.toString('utf8') ?? ''
  assert.ok(xml.includes('w:lineRule="atLeast"')); assert.ok(xml.includes('w:cantSplit')); assert.ok(xml.includes('w:tblHeader')); assert.ok(xml.includes('w:fill="edf2f2"'))
})

void test('recursive exchange rejects conflicting cell authorities, deep/cyclic input and cross-cell review', async () => {
  const raw: WordDocument = { schemaVersion: 1, layout: defaultLayout(), changes: [], comments: [], blocks: [{ type: 'table', id: 'outer', widths: [100], rows: [{ id: 'row', cells: [{ id: 'cell', paragraphs: [{ type: 'paragraph', id: 'p', style: {}, runs: [{ id: 'r', text: 'Text', style: {} }] }], blocks: [{ type: 'pageBreak', id: 'break' }] }] }] }] }
  assert.equal(documentSchema.safeParse(raw).success, false)
  const cycle: Record<string, unknown> = {}; cycle['self'] = cycle
  assert.throws(() => validateDocument(cycle), /cyclic|nesting/i)
  const imported = await importDocx(await source()); const paragraphs = paragraphsOf(imported.document).filter(p => p.runs.some(r => r.text === 'Clue' || r.text === 'DC 12'))
  const [left, right] = paragraphs; assert.ok(left); assert.ok(right)
  left.boundaryChangeId = 'cross-cell'
  imported.document.changes.push({ id: 'cross-cell', kind: 'paragraphJoin', authorName: 'Reviewer', createdAt: '2026-10-13T00:00:00Z', status: 'pending', targetRunIds: [], targetBlockIds: [left.id, right.id] })
  await assert.rejects(exportDocx(imported.document, 'retain-review'), /adjacent|container|boundary/i)
})
