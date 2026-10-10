import { createHash } from 'node:crypto'
export const bytesSha256=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
