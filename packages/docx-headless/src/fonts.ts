import path from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { parseDocumentXml } from './packageValidation'
import type { DocumentLayout } from './model'
import type { ZipEntry } from './zipArchive'
import { WordCodecError } from './errors'

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const pr = 'http://schemas.openxmlformats.org/package/2006/relationships'
const key = z.string().regex(/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i)
const face = z.object({ fontKey: key, sha256: z.string().regex(/^[a-f0-9]{64}$/), bytesBase64: z.string().min(44).max(8 * 1024 * 1024).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/), subsetted: z.boolean() }).strict()
const schema = z.array(z.object({ family: z.string().min(1).max(100).refine(value => Array.from(value).every(character => { const code = character.codePointAt(0) ?? 0; return code >= 32 && !(code >= 0xd800 && code <= 0xdfff) && code !== 0xfffe && code !== 0xffff })), regular: face.optional(), bold: face.optional(), italic: face.optional(), boldItalic: face.optional() }).strict()).max(32)
export type WordEmbeddedFont = z.infer<typeof schema>[number]
const slots = ['regular', 'bold', 'italic', 'boldItalic'] as const
const tags = { regular: 'embedRegular', bold: 'embedBold', italic: 'embedItalic', boldItalic: 'embedBoldItalic' }
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** Font binaries remain opaque. Import never installs fonts or reads host paths.
 * Applications must approve these hash-bound faces before passing them to export. */
export function readEmbeddedFonts(files: Map<string, Buffer>): WordEmbeddedFont[] {
  const table = files.get('word/fontTable.xml')
  if (!table) return []
  const relationships = files.get('word/_rels/fontTable.xml.rels')
  const targets = new Map<string, string>()
  if (relationships) for (const relation of Array.from(parseDocumentXml(relationships).getElementsByTagNameNS(pr, 'Relationship'))) {
    if (relation.getAttribute('Type') !== r + '/font' || relation.getAttribute('TargetMode') === 'External') throw new WordCodecError('FONT_RELATIONSHIP_UNSUPPORTED', 'Only local font relationships are supported.', 422)
    const id = relation.getAttribute('Id'); const target = relation.getAttribute('Target')
    if (!id || !target) throw new WordCodecError('FONT_RELATIONSHIP_INVALID', 'Font relationship is incomplete.', 422)
    targets.set(id, target.startsWith('/') ? target.slice(1) : path.posix.normalize('word/' + target))
  }
  const fonts: WordEmbeddedFont[] = []
  for (const element of Array.from(parseDocumentXml(table).getElementsByTagNameNS(w, 'font'))) {
    const font: WordEmbeddedFont = { family: element.getAttributeNS(w, 'name') ?? '' }
    for (const slot of slots) {
      const elements = element.getElementsByTagNameNS(w, tags[slot])
      if (elements.length > 1) throw new WordCodecError('FONT_SLOT_DUPLICATE', 'Font face slot is duplicated.', 422)
      const entry = elements.item(0)
      if (!entry) continue
      const target = targets.get(entry.getAttributeNS(r, 'id') ?? ''); const bytes = target ? files.get(target) : undefined
      if (!bytes) throw new WordCodecError('FONT_PART_MISSING', 'Embedded font face is missing.', 422)
      font[slot] = { fontKey: entry.getAttributeNS(w, 'fontKey') ?? '', sha256: digest(bytes), bytesBase64: bytes.toString('base64'), subsetted: ['1', 'true', 'on'].includes(entry.getAttributeNS(w, 'subsetted') ?? '') }
    }
    if (slots.some(slot => font[slot])) fonts.push(font)
  }
  return validateEmbeddedFonts(fonts)
}

export function validateEmbeddedFonts(input: unknown): WordEmbeddedFont[] {
  const fonts = schema.parse(input); const families = new Set<string>(); let total = 0
  for (const font of fonts) {
    if (families.has(font.family.normalize('NFC').toLocaleLowerCase('und')) || !slots.some(slot => font[slot])) throw new WordCodecError('FONT_FAMILY_INVALID', 'Embedded font families must be unique with at least one face.', 422)
    families.add(font.family.normalize('NFC').toLocaleLowerCase('und'))
    for (const slot of slots) {
      const face = font[slot]; if (!face) continue
      const bytes = Buffer.from(face.bytesBase64, 'base64'); total += bytes.length
      if (bytes.length < 32 || bytes.length > 6 * 1024 * 1024 || total > 24 * 1024 * 1024 || digest(bytes) !== face.sha256 || bytes.toString('base64') !== face.bytesBase64) throw new WordCodecError('FONT_BYTES_INVALID', 'Embedded font bytes exceed bounds or differ from their digest.', 422)
    }
  }
  return fonts
}

export function requireEmbeddedFonts(bindings: NonNullable<DocumentLayout['embeddedFontFaces']>, fonts: readonly WordEmbeddedFont[]): void {
  if (bindings.some(binding => !fonts.some(font => font.family === binding.family && font[binding.slot]?.sha256 === binding.sha256 && font[binding.slot]?.fontKey.toUpperCase() === binding.fontKey.toUpperCase()))) throw new WordCodecError('FONT_APPROVAL_REQUIRED', 'This imported document requires explicitly approved embedded fonts. Export cannot silently fall back to system fonts.', 409)
}

export function embeddedFontParts(input: unknown): { files: ZipEntry[]; overrides: string } {
  const fonts = validateEmbeddedFonts(input); const files: ZipEntry[] = []; const relations: string[] = []; const entries: string[] = []; const seen = new Set<string>()
  for (const font of fonts) {
    const entriesForFamily: string[] = []
    for (const slot of slots) {
      const face = font[slot]; if (!face) continue
      const filename = face.sha256 + '.odttf'
      if (!seen.has(filename)) { files.push({ name: 'word/fonts/' + filename, content: Buffer.from(face.bytesBase64, 'base64') }); seen.add(filename) }
      const id = 'font' + (relations.length + 1)
      relations.push(`<Relationship Id="${id}" Type="${r}/font" Target="fonts/${filename}"/>`)
      entriesForFamily.push(`<w:${tags[slot]} r:id="${id}" w:fontKey="${face.fontKey}" w:subsetted="${face.subsetted ? '1' : '0'}"/>`)
    }
    entries.push(`<w:font w:name="${escape(font.family)}">${entriesForFamily.join('')}</w:font>`)
  }
  if (!fonts.length) return { files, overrides: '' }
  files.push({ name: 'word/fontTable.xml', content: `<w:fonts xmlns:w="${w}" xmlns:r="${r}">${entries.join('')}</w:fonts>` }, { name: 'word/_rels/fontTable.xml.rels', content: `<Relationships xmlns="${pr}">${relations.join('')}</Relationships>` })
  return { files, overrides: '<Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>' + Array.from(seen).map(name => `<Override PartName="/word/fonts/${name}" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>`).join('') }
}
