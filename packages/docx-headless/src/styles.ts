import { createHash } from 'node:crypto'
import { defaultLayout,type ParagraphStyle,type TextStyle } from './model'
import { validateDocument } from './validation'
import { WordCodecError } from './errors'
export interface WordStyleDefinition {kind?:'paragraph'|'character';paragraph:ParagraphStyle;run:TextStyle;label?:string}
export type WordStyleDefinitions=Record<string,WordStyleDefinition>;
export function validateStyles(raw:WordStyleDefinitions):WordStyleDefinitions {
 if(Object.keys(raw).length>1000)throw new WordCodecError('EXPORT_STYLE_LIMIT','At most 1000 named styles are supported.',413)
 for(const [id,style] of Object.entries(raw)){if(style.kind!==undefined&&!['paragraph','character'].includes(style.kind))throw new WordCodecError('EXPORT_STYLE_INVALID','Style kind is invalid.',422);if(!/^[a-zA-Z0-9_.:-]{1,100}$/.test(id)||style.label!==undefined&&(!style.label.length||style.label.length>512))throw new WordCodecError('EXPORT_STYLE_INVALID','Named style IDs or display labels are invalid.',422);validateDocument({schemaVersion:1,blocks:[{type:'paragraph',id:'style-p',style:style.paragraph,runs:[{id:'style-r',text:'',style:style.run}]}],layout:defaultLayout(),changes:[],comments:[]})}
 const visit=(id:string,seen=new Set<string>())=>{if(seen.has(id)||seen.size>=32)throw new WordCodecError('EXPORT_STYLE_INVALID','Character style inheritance is cyclic or too deep.',422);const definition=raw[id];if(!definition||definition.kind!=='character')throw new WordCodecError('EXPORT_STYLE_INVALID','Character style parent is undefined.',422);if(definition.run.characterStyleId)visit(definition.run.characterStyleId,new Set([...seen,id]))}
 for(const definition of Object.values(raw))if(definition.run.characterStyleId)visit(definition.run.characterStyleId)
 return raw
}
export const importedStyleId=(definition:WordStyleDefinition)=>'word-style-'+createHash('sha256').update(JSON.stringify(definition)).digest('hex').slice(0,16)
