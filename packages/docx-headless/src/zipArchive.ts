import { ZipFile } from 'yazl'
import { deflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string;
  content: string | Buffer;
  store?: boolean;
}

export function createZipBuffer(entries: ZipEntry[]): Promise<Buffer> {
  const archive = new ZipFile()
  const chunks: Buffer[] = []
  archive.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    archive.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    archive.outputStream.on('error', reject)
    archive.on('error', reject)
  })

  for (const entry of entries) {
    const content = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8')
    // Keep packages within the secure import expansion bound. Highly repetitive
    // manuscripts legitimately exceed it under DEFLATE; storing those entries
    // preserves their exact bytes without weakening archive preflight.
    const store = entry.store || (content.length >= 1024 &&
      content.length > Math.max(1, deflateRawSync(content, { level: 9 }).length) * 190)
    archive.addBuffer(content, entry.name, {
      compress: !store,
      compressionLevel: store ? 0 : 9,
    })
  }
  archive.end()
  return done
}
