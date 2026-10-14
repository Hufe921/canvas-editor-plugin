import { XMLSerializer, type Element } from '@xmldom/xmldom'
import { exportDocx, type ExportMode } from './export'
import type { WordDocument } from './model'
import type { DocxAsset } from './export'
import type { WordStories } from './stories'
import type { WordStyleDefinitions } from './styles'
import { WordCodecError } from './errors'
const escapeXml=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
export interface WordPackageInput {sections:Array<{title:string;startsSection?:boolean;suppressTitle?:boolean;breakAfter?:'continuous'|'nextPage';document:WordDocument;stories?:WordStories}>;assets:Map<number,DocxAsset>;styleDefinitions?:WordStyleDefinitions}

import { parseDocumentXml, validateDocxPackage } from './packageValidation'
import { createZipBuffer, type ZipEntry } from './zipArchive'
const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const pr = 'http://schemas.openxmlformats.org/package/2006/relationships'
const ct = 'http://schemas.openxmlformats.org/package/2006/content-types'
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const serialize = (element: Element) => new XMLSerializer().serializeToString(element)
/** Merge independently validated scene packages without flattening their review,
 * assets or section stories. All part, relationship and numeric identities are rebased. */
export async function exportDocxSections(input: WordPackageInput, mode: ExportMode): Promise<Buffer> {
  const nativeRanges=input.sections.reduce((count,section)=>count+section.document.comments.length,0)
  if(mode==='retain-review'&&nativeRanges>32767)throw new WordCodecError('EXPORT_COMMENT_RANGE_LIMIT','Word supports at most 32767 native comment ranges per document. Resolve review or export an explicit final/original projection with review sidecar.',409,{nativeRanges,maximum:32767})
  const files: ZipEntry[] = []
  const body: string[] = []
  const relationships: string[] = []
  const overrides: string[] = []
  const comments: string[] = []
  const numbers: string[] = []
  const styles: string[] = []
  let relationshipIndex = 0
  let commentIndex = 0
  let numberIndex = 0
  let abstractIndex = 0
  let drawingIndex = 0
  let revisionIndex = 0
  for (let sectionIndex = 0; sectionIndex < input.sections.length; sectionIndex++) {
    const source = await validateDocxPackage(
      await exportDocx(input.sections[sectionIndex].document, mode, input.assets, input.sections[sectionIndex].stories,input.styleDefinitions),
      true,
    )
    const prefix = `section-${sectionIndex}`
    const doc = parseDocumentXml(source.get('word/document.xml')!)
    const relationshipMap = new Map<string, string>()
    const sourceRelations = parseDocumentXml(
      source.get('word/_rels/document.xml.rels')!,
    ).getElementsByTagNameNS(pr, 'Relationship')
    for (let index = 0; index < sourceRelations.length; index++) {
      const element = sourceRelations.item(index)!
      const type = element.getAttribute('Type')!
      if (/\/(styles|numbering|comments|settings)$/.test(type)) continue
      const id = `rId${++relationshipIndex}`
      relationshipMap.set(element.getAttribute('Id')!, id)
      element.setAttribute('Id', id)
      if (element.getAttribute('TargetMode') !== 'External')
        element.setAttribute('Target', `${prefix}/${element.getAttribute('Target')}`)
      relationships.push(serialize(element))
    }
    const sourceComments = source.get('word/comments.xml')
    const commentMap = new Map<string, string>()
    if (sourceComments) {
      const elements = parseDocumentXml(sourceComments).getElementsByTagNameNS(w, 'comment')
      for (let index = 0; index < elements.length; index++) {
        const element = elements.item(index)!
        const id = String(commentIndex++)
        commentMap.set(element.getAttribute('w:id')!, id)
        element.setAttribute('w:id', id)
        comments.push(serialize(element))
      }
    }
    const numbering = source.get('word/numbering.xml')
    const numberMap = new Map<string, string>()
    if (numbering) {
      const elements = parseDocumentXml(numbering)
      const abstractMap = new Map<string, string>()
      const abstracts = elements.getElementsByTagNameNS(w, 'abstractNum')
      for (let index = 0; index < abstracts.length; index++) {
        const element = abstracts.item(index)!
        const id = String(abstractIndex++)
        abstractMap.set(element.getAttribute('w:abstractNumId')!, id)
        element.setAttribute('w:abstractNumId', id)
        numbers.push(serialize(element))
      }
      const nums = elements.getElementsByTagNameNS(w, 'num')
      for (let index = 0; index < nums.length; index++) {
        const element = nums.item(index)!
        const id = String(++numberIndex)
        numberMap.set(element.getAttribute('w:numId')!, id)
        element.setAttribute('w:numId', id)
        const abstract = element.getElementsByTagNameNS(w, 'abstractNumId').item(0)!
        abstract.setAttribute('w:val', abstractMap.get(abstract.getAttribute('w:val')!)!)
        numbers.push(serialize(element))
      }
    }
    const styleElements = parseDocumentXml(source.get('word/styles.xml')!).getElementsByTagNameNS(
      w,
      'style',
    )
    for (let index = 0; index < styleElements.length; index++) {
      const element = styleElements.item(index)!
      const originalId=element.getAttribute('w:styleId')!
      element.setAttribute('w:styleId', `${prefix}-${element.getAttribute('w:styleId')}`)
      element.removeAttribute('w:default')
      const name = element.getElementsByTagNameNS(w, 'name').item(0)
      if (name && !input.styleDefinitions?.[originalId]) name.setAttribute('w:val', `${prefix}-${name.getAttribute('w:val')}`)
      const based = element.getElementsByTagNameNS(w, 'basedOn').item(0)
      if (based) based.setAttribute('w:val', `${prefix}-${based.getAttribute('w:val')}`)
      styles.push(serialize(element))
    }
    const descendants = doc.getElementsByTagName('*')
    for (let index = 0; index < descendants.length; index++) {
      const element = descendants.item(index)!
      for (const name of ['id', 'embed', 'link']) {
        const value = element.getAttributeNS(r, name)
        if (value && relationshipMap.has(value))
          element.setAttributeNS(r, `r:${name}`, relationshipMap.get(value)!)
      }
      if (
        element.namespaceURI === w &&
        ['commentRangeStart', 'commentRangeEnd', 'commentReference'].includes(element.localName!)
      )
        element.setAttribute('w:id', commentMap.get(element.getAttribute('w:id')!)!)
      if (element.namespaceURI === w && element.localName === 'numId')
        element.setAttribute('w:val', numberMap.get(element.getAttribute('w:val')!)!)
      if (
        element.namespaceURI === w &&
        ['pStyle','rStyle'].includes(element.localName!) &&
        !element.getAttribute('w:val')?.startsWith(prefix + '-')
      )
        element.setAttribute('w:val', `${prefix}-${element.getAttribute('w:val')}`)
      if (
        element.namespaceURI === w &&
        ['ins', 'del', 'rPrChange', 'pPrChange'].includes(element.localName!)
      )
        element.setAttribute('w:id', String(revisionIndex++))
      if (element.localName === 'docPr' || element.localName === 'cNvPr')
        element.setAttribute('id', String(++drawingIndex))
      if (
        element.namespaceURI === w &&
        element.localName === 'pPr' &&
        !element.getElementsByTagNameNS(w, 'pStyle').length
      ) {
        const style = doc.createElementNS(w, 'w:pStyle')
        style.setAttribute('w:val', `${prefix}-Normal`)
        element.insertBefore(style, element.firstChild)
      }
    }
    const sourceBody = doc.getElementsByTagNameNS(w, 'body').item(0)!
    const section = sourceBody.getElementsByTagNameNS(w, 'sectPr').item(0)!
    if (input.sections[sectionIndex].startsSection && !input.sections[sectionIndex].suppressTitle)
      body.push(
        `<w:p><w:pPr><w:pStyle w:val="${prefix}-Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(input.sections[sectionIndex].title)}</w:t></w:r></w:p>`,
      )
    const breakAfter = input.sections[sectionIndex].breakAfter ?? (input.sections[sectionIndex + 1]?.startsSection === false ? 'continuous' : undefined)
    if (breakAfter) {
      const type = doc.createElementNS(w, 'w:type')
      type.setAttribute('w:val', breakAfter)
      const size = section.getElementsByTagNameNS(w, 'pgSz').item(0)
      section.insertBefore(type, size)
    }
    const children = Array.from(sourceBody.childNodes).filter((node): node is Element => node.nodeType === 1 && node !== section)
    const last = children.at(-1)
    if (sectionIndex !== input.sections.length - 1 && last?.namespaceURI === w && last.localName === 'p') {
      let properties = Array.from(last.childNodes).find((node): node is Element => node.nodeType === 1 && 'namespaceURI' in node && node.namespaceURI === w && 'localName' in node && node.localName === 'pPr')
      if (!properties) { properties = doc.createElementNS(w, 'w:pPr'); last.insertBefore(properties, last.firstChild) }
      properties.appendChild(section)
    }
    for (const child of children) body.push(serialize(child))
    if (sectionIndex === input.sections.length - 1) body.push(serialize(section))
    else if (last?.namespaceURI !== w || last.localName !== 'p') body.push(`<w:p><w:pPr>${serialize(section)}</w:pPr></w:p>`)
    const sourceTypes = parseDocumentXml(source.get('[Content_Types].xml')!).getElementsByTagNameNS(
      ct,
      'Override',
    )
    for (let index = 0; index < sourceTypes.length; index++) {
      const type = sourceTypes.item(index)!
      const part = type.getAttribute('PartName')!
      if (
        [
          '/word/document.xml',
          '/word/styles.xml',
          '/word/settings.xml',
          '/word/comments.xml',
          '/word/numbering.xml',
        ].includes(part)
      )
        continue
      type.setAttribute('PartName', part.replace('/word/', `/word/${prefix}/`))
      overrides.push(serialize(type))
    }
    for (const [name, bytes] of source)
      if (
        name.startsWith('word/') &&
        ![
          'word/document.xml',
          'word/styles.xml',
          'word/settings.xml',
          'word/comments.xml',
          'word/numbering.xml',
          'word/_rels/document.xml.rels',
        ].includes(name)
      ) {
        let content = bytes
        if (/^word\/(header|footer)\d+\.xml$/.test(name)) {
          const storyDoc = parseDocumentXml(bytes)
          const paragraphs = storyDoc.getElementsByTagNameNS(w, 'p')
          for (let index = 0; index < paragraphs.length; index++) {
            const paragraph = paragraphs.item(index)!
            let properties = paragraph.getElementsByTagNameNS(w, 'pPr').item(0)
            if (!properties) {
              properties = storyDoc.createElementNS(w, 'w:pPr')
              paragraph.insertBefore(properties, paragraph.firstChild)
            }
            let style = properties.getElementsByTagNameNS(w, 'pStyle').item(0)
            if (!style) {
              style = storyDoc.createElementNS(w, 'w:pStyle')
              style.setAttribute('w:val', 'Normal')
              properties.insertBefore(style, properties.firstChild)
            }
            style.setAttribute('w:val', `${prefix}-${style.getAttribute('w:val')}`)
          }
          for(const reference of Array.from(storyDoc.getElementsByTagNameNS(w,'rStyle')))reference.setAttribute('w:val',`${prefix}-${reference.getAttribute('w:val')}`)
          for (const number of Array.from(storyDoc.getElementsByTagNameNS(w, 'numId')))
            number.setAttribute('w:val', numberMap.get(number.getAttribute('w:val')!)!)
          for (const element of Array.from(storyDoc.getElementsByTagName('*'))) {
            if (element.namespaceURI === w && ['commentRangeStart','commentRangeEnd','commentReference'].includes(element.localName!)) element.setAttribute('w:id',commentMap.get(element.getAttribute('w:id')!)!)
            if (element.namespaceURI === w && ['ins','del','rPrChange','pPrChange'].includes(element.localName!)) element.setAttribute('w:id',String(revisionIndex++))
            if (element.localName === 'docPr' || element.localName === 'cNvPr') element.setAttribute('id',String(++drawingIndex))
          }
          content = Buffer.from(new XMLSerializer().serializeToString(storyDoc))
        }
        if (/^word\/_rels\/(header|footer)\d+\.xml\.rels$/.test(name)) {
          const relationshipsDoc=parseDocumentXml(content)
          for(const element of Array.from(relationshipsDoc.getElementsByTagNameNS(pr,'Relationship'))) if(element.getAttribute('Type')===r+'/comments') element.setAttribute('Target','../comments.xml')
          content=Buffer.from(new XMLSerializer().serializeToString(relationshipsDoc))
        }
        files.push({ name: name.replace('word/', `word/${prefix}/`), content })
      }
  }
  const relation = (type: string, target: string) =>
    relationships.push(
      `<Relationship Id="rId${++relationshipIndex}" Type="${r}/${type}" Target="${target}"/>`,
    )
  relation('styles', 'styles.xml')
  relation('settings', 'settings.xml')
  if (numbers.length) {
    relation('numbering', 'numbering.xml')
    files.push({
      name: 'word/numbering.xml',
      content: `${declaration}<w:numbering xmlns:w="${w}">${numbers.join('')}</w:numbering>`,
    })
  }
  if (comments.length) {
    relation('comments', 'comments.xml')
    files.push({
      name: 'word/comments.xml',
      content: `${declaration}<w:comments xmlns:w="${w}">${comments.join('')}</w:comments>`,
    })
  }
  const names = [
    'document',
    'styles',
    'settings',
    ...(numbers.length ? ['numbering'] : []),
    ...(comments.length ? ['comments'] : []),
  ]
  files.push({
    name: '[Content_Types].xml',
    content: `${declaration}<Types xmlns="${ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>${names.map((name) => `<Override PartName="/word/${name}.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${name === 'document' ? 'document.main' : name}+xml"/>`).join('')}${overrides.join('')}</Types>`,
  })
  files.push({
    name: '_rels/.rels',
    content: `${declaration}<Relationships xmlns="${pr}"><Relationship Id="rId1" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>`,
  })
  files.push({
    name: 'word/document.xml',
    content: `${declaration}<w:document xmlns:w="${w}" xmlns:r="${r}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body.join('') || '<w:p/>'}</w:body></w:document>`,
  })
  files.push({
    name: 'word/_rels/document.xml.rels',
    content: `${declaration}<Relationships xmlns="${pr}">${relationships.join('')}</Relationships>`,
  })
  files.push({
    name: 'word/styles.xml',
    content: `${declaration}<w:styles xmlns:w="${w}">${styles.join('')}</w:styles>`,
  })
  files.push({
    name: 'word/settings.xml',
    content: `${declaration}<w:settings xmlns:w="${w}">${mode === 'retain-review' ? '<w:trackRevisions/>' : ''}</w:settings>`,
  })
  const bytes = await createZipBuffer(files)
  await validateDocxPackage(bytes, true)
  return bytes
}
