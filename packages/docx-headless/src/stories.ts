import { createHash } from 'node:crypto'
import { validateDocument } from './validation'
import { paragraphsOf, type WordDocument, type DocumentBlock } from './model'
export interface WordStories {header?:WordDocument;footer?:WordDocument}
/** Part namespaces isolate neutral document identities without application knowledge. */
export function namespaceDocument(raw:WordDocument, part:string):WordDocument {
 const document=structuredClone(validateDocument(raw));const id=(value:string)=>createHash('sha256').update(part+':'+value).digest('hex')
 for(const block of document.blocks){if(block.type!=='paragraph')block.id=id(block.id);if(block.type==='table')for(const row of block.rows){row.id=id(row.id);for(const cell of row.cells)cell.id=id(cell.id)}}
 for(const paragraph of paragraphsOf(document,true)){paragraph.id=id(paragraph.id);if(paragraph.changeId)paragraph.changeId=id(paragraph.changeId);if(paragraph.boundaryChangeId)paragraph.boundaryChangeId=id(paragraph.boundaryChangeId);for(const run of paragraph.runs){run.id=id(run.id);if(run.changeId)run.changeId=id(run.changeId)}}
 for(const change of document.changes){change.id=id(change.id);change.targetRunIds=change.targetRunIds.map(id);if(change.targetBlockIds)change.targetBlockIds=change.targetBlockIds.map(id)}
 for(const comment of document.comments){comment.id=id(comment.id);comment.anchors=comment.anchors.map((anchor)=>({...anchor,blockId:id(anchor.blockId),runId:id(anchor.runId)}))}
 return document
}
export function composeWordStories(raw:WordDocument, stories?:WordStories):{document:WordDocument;headerBlocks:DocumentBlock[];footerBlocks:DocumentBlock[]} {
 if(!stories)return{document:validateDocument(raw),headerBlocks:raw.layout.header,footerBlocks:raw.layout.footer}
 const document=namespaceDocument(raw,'main');const header=stories.header?namespaceDocument(stories.header,'header'):undefined;const footer=stories.footer?namespaceDocument(stories.footer,'footer'):undefined
 if(header){document.layout.header=paragraphsOf(header,false);document.changes.push(...header.changes);document.comments.push(...header.comments)}
 if(footer){document.layout.footer=paragraphsOf(footer,false);document.changes.push(...footer.changes);document.comments.push(...footer.comments)}
 return {document,headerBlocks:header?.blocks??document.layout.header,footerBlocks:footer?.blocks??document.layout.footer}
}
