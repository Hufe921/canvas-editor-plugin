import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { importDocx, exportDocxSections, paragraphsOf, allBlocks } from '../src/index'

/** Development-only probe. No originals are changed and losses never imply readiness. */
async function main(): Promise<void> {
  const source = process.argv[2]; const destination = process.argv[3]
  if (!source || !destination || path.resolve(source) === path.resolve(destination)) throw new Error('Expected separate source DOCX and candidate output path')
  const bytes = await readFile(source)
  const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex')
  try {
    const imported = await importDocx(bytes)
    const text = paragraphsOf(imported.document).map(paragraph => paragraph.runs.filter(run => !run.inlineImage).map(run => run.text).join('')).join('\n')
    const output = await exportDocxSections({ sections: imported.sections.map(section => ({ title: '', suppressTitle: true, breakAfter: section.breakAfter, document: section.document, stories: section.stories })), styleDefinitions: imported.styleDefinitions, assets: new Map(imported.assets.map(asset => [asset.placeholderId, { bytes: Buffer.from(asset.bytesBase64, 'base64'), mediaType: asset.mediaType }])) }, 'retain-review')
    const reopened = await importDocx(output)
    const reopenedText = paragraphsOf(reopened.document).map(paragraph => paragraph.runs.filter(run => !run.inlineImage).map(run => run.text).join('')).join('\n')
    await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, output, { flag: 'wx' })
    console.log(JSON.stringify({ schemaVersion: 1, sourceSha256: sha(bytes), sourceBytes: bytes.length, status: 'candidate', printAccepted: false, losses: imported.losses, reopenLosses: reopened.losses, textEqual: text === reopenedText, tables: allBlocks(imported.document.blocks).filter(block => block.type === 'table').length, sections: imported.sections.length, images: imported.assets.length, changes: imported.document.changes.length, comments: imported.document.comments.length, outputSha256: sha(output), outputBytes: output.length }))
  } catch (error: unknown) {
    console.log(JSON.stringify({ schemaVersion: 1, sourceSha256: sha(bytes), sourceBytes: bytes.length, status: 'blocked', printAccepted: false, error: error instanceof Error ? error.message : 'Unknown codec failure' }))
  }
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Probe failed'); process.exitCode = 1 })
