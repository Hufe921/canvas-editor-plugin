import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { defaultLayout, exportDocx, exportDocxSections, importDocx, validateEmbeddedFonts, validateDocxPackage, createZipBuffer, type WordDocument, type WordEmbeddedFont } from '../src/index'
import { validateDocument } from '../src/validation'

test('explicit font approval retains each opaque face and rejects changed bytes before export', async () => {
  const bytes = Buffer.alloc(64, 17)
  const face = { fontKey: '{00112233-4455-6677-8899-AABBCCDDEEFF}', sha256: createHash('sha256').update(bytes).digest('hex'), bytesBase64: bytes.toString('base64'), subsetted: false }
  const fonts: WordEmbeddedFont[] = [{ family: 'Approved Fixture', regular: face, bold: face, italic: face, boldItalic: face }]
  const document: WordDocument = { schemaVersion: 1, blocks: [{ type: 'paragraph', id: 'p', style: {}, runs: [{ id: 'r', text: 'Body text', style: { font: 'Approved Fixture' } }] }], changes: [], comments: [], layout: { ...defaultLayout(), pageNumbers: false } }
  assert.deepEqual((await importDocx(await exportDocx(document, 'final', new Map(), undefined, {}, fonts))).fonts, fonts)
  assert.equal((await importDocx(await exportDocx(document, 'final'))).fonts.length, 0)
  const multi = await exportDocxSections({ sections: [{title:'',document},{title:'',document}], assets: new Map(), approvedFonts: fonts }, 'final')
  assert.deepEqual((await importDocx(multi)).fonts, fonts)
  const imported = await importDocx(await exportDocx(document, 'final', new Map(), undefined, {}, fonts))
  await assert.rejects(exportDocx(imported.document,'final'), /approved embedded fonts/)
  await assert.rejects(exportDocx(imported.document,'final',new Map(),undefined,imported.styleDefinitions,[{...fonts[0],regular:{...face,fontKey:'{FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}'}}]), /approved embedded fonts/)
  assert.throws(() => validateEmbeddedFonts([{ ...fonts[0], regular: { ...face, sha256: '0'.repeat(64) } }]), /digest/)
  assert.throws(() => validateEmbeddedFonts([...fonts, ...fonts]), /unique/)
  assert.throws(() => validateEmbeddedFonts([{ ...fonts[0], regular: { ...face, fontKey: 'unsafe' } }]))
})

test('document defaults and style parents remain independent from direct formatting',async()=>{
  const document:WordDocument={schemaVersion:1,compatibilityMode:15,defaults:{paragraph:{after:8,lineSpacing:18,lineRule:'atLeast'},run:{font:'Georgia',size:16,color:'#19383d',characterSpacing:1.2}},layout:{...defaultLayout(),pageNumbers:false},blocks:[{type:'paragraph',id:'p',style:{name:'child'},runs:[{id:'r',text:'Inherited typography with direct bold.',style:{bold:true}}]}],changes:[],comments:[]}
  const definitions={parent:{kind:'paragraph' as const,label:'Parent',paragraph:{},run:{italic:true}},child:{kind:'paragraph' as const,label:'Child',basedOn:'parent',paragraph:{},run:{}}}
  const reopened=await importDocx(await exportDocx(document,'final',new Map(),undefined,definitions))
  assert.deepEqual(reopened.document.defaults,document.defaults)
  assert.equal(reopened.document.compatibilityMode,15)
  const child=Object.values(reopened.styleDefinitions).find(definition=>definition.label==='Child');assert.ok(child?.basedOn);assert.equal(reopened.styleDefinitions[child.basedOn]?.label,'Parent');assert.deepEqual(child.run,{})
  const paragraph=reopened.document.blocks[0];assert.ok(paragraph?.type==='paragraph');assert.deepEqual(paragraph.runs[0]?.style,{bold:true})
  const other=structuredClone(document);other.defaults={paragraph:{after:12},run:{font:'Georgia',size:16}}
  await assert.rejects(exportDocxSections({sections:[{title:'',document},{title:'',document:other}],assets:new Map(),styleDefinitions:definitions},'final'),/document-wide defaults/)
  const old = structuredClone(document); old.compatibilityMode=14
  await assert.rejects(exportDocxSections({sections:[{title:'',document},{title:'',document:old}],assets:new Map(),styleDefinitions:definitions},'final'),/compatibility/)
})

test('image distances are explicit and unsupported crop or spacing cannot silently qualify a conversion',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1cAAAAASUVORK5CYII=','base64')
  const document:WordDocument={schemaVersion:1,layout:{...defaultLayout(),pageNumbers:false},blocks:[{type:'image',id:'map',assetId:1,sha256:createHash('sha256').update(png).digest('hex'),width:96,height:96,alt:'Map'}],changes:[],comments:[]}
  const packageBytes=await exportDocx(document,'final',new Map([[1,{bytes:png,mediaType:'image/png'}]]))
  const files=await validateDocxPackage(packageBytes,true)
  const xml=files.get('word/document.xml')?.toString();assert.ok(xml)
  assert.ok(xml.includes('distT="0" distB="0" distL="0" distR="0"'))
  assert.equal((await importDocx(packageBytes)).losses.filter(loss=>loss.code.startsWith('IMAGE_')).length,0)
  files.set('word/document.xml',Buffer.from(xml.replace('distL="0"','distL="114300"')))
  const spaced=await importDocx(await createZipBuffer([...files].map(([name,content])=>({name,content}))))
  assert.ok(spaced.losses.some(loss=>loss.code==='IMAGE_PRESENTATION_UNSUPPORTED'))
  files.set('word/document.xml',Buffer.from(xml.replace(' distL="0"','')))
  const missing=await importDocx(await createZipBuffer([...files].map(([name,content])=>({name,content}))))
  assert.ok(missing.losses.some(loss=>loss.code==='IMAGE_DISTANCE_UNSPECIFIED'))
})

test('dynamic page fields remain at their authored position and cannot acquire text or review anchors', async () => {
  const document: WordDocument = { schemaVersion: 1, blocks: [], changes: [], comments: [], layout: { ...defaultLayout(), pageNumbers: true, footer: [{ type: 'paragraph', id: 'footer', style: {alignment:'right'}, runs: [{id:'label',text:'MODULE · ',style:{}},{id:'page',text:'',field:'pageNumber',style:{font:'Georgia',size:16}}] }] } }
  const reopened = await importDocx(await exportDocx(document, 'retain-review'))
  const footer = reopened.sections[0]?.stories?.footer?.blocks
  assert.equal(footer?.length, 1)
  const paragraph = footer?.[0]; assert.ok(paragraph?.type === 'paragraph')
  assert.equal(paragraph.style.alignment, 'right')
  assert.equal(paragraph.runs.map(run => run.text).join(''), 'MODULE · ')
  assert.equal(paragraph.runs.filter(run => run.field === 'pageNumber').length, 1)
  assert.ok(!reopened.losses.some(loss => loss.code === 'PAGE_FIELD_POSITION'))
  const corrupted = structuredClone(document); const field = corrupted.layout.footer[0]?.runs[1]; assert.ok(field); field.text = '1'
  assert.throws(() => validateDocument(corrupted), /schema/)
  const anchored = structuredClone(document); anchored.comments.push({id:'comment',authorName:'Reviewer',createdAt:'2026-10-14T00:00:00.000Z',text:'No guessed field anchors',resolved:false,anchors:[{blockId:'footer',runId:'page',start:0,end:0,sourceText:''}]})
  assert.throws(() => validateDocument(anchored), /protected/)
})
