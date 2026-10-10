import { fromBuffer, type Entry, type ZipFile } from 'yauzl'
import { DOMParser, type Document } from '@xmldom/xmldom'
import { SaxesParser } from 'saxes'
import { WordCodecError } from './errors'

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
export function crc32(bytes: Buffer): number {
  let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
/** Validate actual decompressed bytes, sizes, CRCs and paths before XML conversion. */
export function readDocumentPackage(bytes: Buffer, generated = false): Promise<Map<string, Buffer>> {
  if (bytes.byteLength > (generated ? 256 : 32) * 1024 * 1024) throw new WordCodecError('IMPORT_TOO_LARGE', generated ? 'Generated package exceeds 256 MiB.' : 'DOCX upload exceeds 32 MiB.', 413)
  return new Promise((resolve, reject) => {
    let archive: ZipFile | undefined; let settled = false; let total = 0; let count = 0
    const files = new Map<string, Buffer>()
    const normalizedNames=new Set<string>()
    const fail = (error: unknown) => { if (settled) return; settled = true; archive?.close(); reject(new WordCodecError('INVALID_DOCUMENT_PACKAGE', error instanceof Error ? error.message : 'Invalid ZIP package.', 422)) }
    fromBuffer(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) return fail(error); archive = zip
      zip.on('error', fail)
      zip.on('end', () => { if (!settled) { settled = true; resolve(files) } })
      zip.on('entry', (entry: Entry) => {
        if (settled) return
        if (++count > 10000) return fail(new Error('ZIP entry count exceeds 10,000.'))
        const name = entry.fileName
        if (!name || /[\\\0]/.test(name) || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some((part) => part === '..' || part === '.') || files.has(name)) return fail(new Error('Unsafe or duplicate ZIP entry.'))
        const normalizedName=name.replace(/\/+/g,'/').normalize('NFC')
        if(normalizedNames.has(normalizedName))return fail(new Error('Duplicate normalized ZIP entry.'));normalizedNames.add(normalizedName)
        if (entry.generalPurposeBitFlag & 1) return fail(new Error('Encrypted ZIP entries are unsupported.'))
        if (entry.uncompressedSize > 64 * 1024 * 1024 || entry.uncompressedSize > Math.max(1, entry.compressedSize) * (generated ? 100_000 : 200)) return fail(new Error('ZIP decompression limit exceeded.'))
        if (name.endsWith('/')) { files.set(name, Buffer.alloc(0)); zip.readEntry(); return }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail(streamError)
          const chunks: Buffer[] = []; let size = 0
          stream.on('error', fail)
          stream.on('data', (chunk: Buffer) => {
            size += chunk.length; total += chunk.length
            if (size > 64 * 1024 * 1024 || total > 256 * 1024 * 1024) { stream.destroy(); fail(new Error('ZIP decompression limit exceeded.')); return }
            chunks.push(chunk)
          })
          stream.on('end', () => {
            if (settled) return
            const content = Buffer.concat(chunks)
            if (content.length !== entry.uncompressedSize || crc32(content) !== entry.crc32) return fail(new Error('ZIP size or CRC mismatch.'))
            files.set(name, content); zip.readEntry()
          })
        })
      })
      zip.readEntry()
    })
  })
}
export function parseDocumentXml(bytes: Buffer): Document {
  if (bytes.length > 16 * 1024 * 1024) throw new WordCodecError('DOCUMENT_XML_LIMIT', 'XML part exceeds 16 MiB.', 422)
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw new WordCodecError('INVALID_DOCUMENT_XML_ENCODING', 'Document XML must use valid UTF-8.', 422) }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text)) throw new WordCodecError('UNSAFE_DOCUMENT_XML', 'DTD and entity declarations are unsupported.', 422)
  // Enforce complexity while streaming, before allocating a DOM. Count all
  // nodes, not just elements, and stop on namespace/character errors.
  let count = 0; let depth = 0
  const node = () => { if (++count > 200_000) throw new WordCodecError('DOCUMENT_XML_LIMIT', 'Document XML node limit exceeded.', 422) }
  const parser = new SaxesParser({ xmlns: true, defaultXMLVersion: '1.0', forceXMLVersion: true })
  parser.on('opentag', (tag) => {
    node()
    if (++depth > 64 || Object.keys(tag.attributes).length > 128) throw new WordCodecError('DOCUMENT_XML_LIMIT', 'Document XML depth or attribute limit exceeded.', 422)
  })
  parser.on('closetag', () => { depth-- })
  parser.on('text', node); parser.on('cdata', node); parser.on('comment', node); parser.on('processinginstruction', node)
  try {
    for (let offset = 0; offset < text.length; offset += 8192) parser.write(text.slice(offset, offset + 8192))
    parser.close()
  } catch (error) {
    if (error instanceof WordCodecError) throw error
    throw new WordCodecError('INVALID_DOCUMENT_XML', 'Malformed document XML.', 422)
  }
  let document: Document
  try { document = new DOMParser({ onError: () => { throw new Error('Malformed document XML.') } }).parseFromString(text, 'application/xml') }
  catch { throw new WordCodecError('INVALID_DOCUMENT_XML', 'Malformed document XML.', 422) }
  if (!document.documentElement) throw new WordCodecError('INVALID_DOCUMENT_XML', 'Document XML has no root element.', 422)
  return document
}
export async function validateDocxPackage(bytes: Buffer, generated = false): Promise<Map<string, Buffer>> {
  const files = await readDocumentPackage(bytes, generated)
  for (const required of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) if (!files.has(required)) throw new WordCodecError('INVALID_DOCX', `Missing DOCX part: ${required}`, 422)
  for (const [name, content] of files) if (name.endsWith('.xml') || name.endsWith('.rels')) parseDocumentXml(content)
  for (const [name, content] of files) if (name.endsWith('.rels')) {
    const relations = parseDocumentXml(content).getElementsByTagNameNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship')
    const ids = new Set<string>()
    for (let index = 0; index < relations.length; index++) {
      const relation = relations.item(index)!; const id = relation.getAttribute('Id')!
      if (!id || ids.has(id)) throw new WordCodecError('INVALID_DOCX_RELATIONSHIP', 'Duplicate or missing relationship ID.', 422); ids.add(id)
      const target = relation.getAttribute('Target') ?? ''
      if (relation.getAttribute('TargetMode') === 'External') {
        if (!/^https?:\/\//i.test(target) || !relation.getAttribute('Type')?.endsWith('/hyperlink')) throw new WordCodecError('UNSAFE_DOCUMENT_RELATIONSHIP', 'Unsupported external relationship.', 422)
        continue // Never fetch an external target.
      }
      const directory = name === '_rels/.rels' ? [] : name.split('/').slice(0, -2)
      const path: string[] = target.startsWith('/') ? [] : [...directory]
      for (const part of target.split('/')) { if (!part || part === '.') continue; if (part === '..') { if (!path.length) throw new WordCodecError('INVALID_DOCX_RELATIONSHIP', 'Relationship escapes package root.', 422); path.pop() } else path.push(part) }
      if (!files.has(path.join('/'))) throw new WordCodecError('INVALID_DOCX_RELATIONSHIP', 'Relationship references a missing part.', 422)
    }
  }
  return files
}
