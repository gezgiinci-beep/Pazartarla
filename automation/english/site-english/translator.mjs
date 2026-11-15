import {fileURLToPath} from 'node:url';

export const MODEL='Xenova/opus-mt-tr-en';
export const MODEL_REVISION='78247f41f354af036d24e6f0f8a3d02c6806f96e';
export const MODEL_LICENSE='Apache-2.0 (Helsinki-NLP/opus-mt-tr-en)';
let instance;
async function translator(){
  instance??=(async()=>{
    const {pipeline,env}=await import('@huggingface/transformers');
    env.cacheDir=fileURLToPath(new URL('../../../generated-artifacts/site-english-model-cache',import.meta.url));
    return pipeline('translation',MODEL,{
      revision:MODEL_REVISION,dtype:'q8',device:'cpu',
      session_options:{intraOpNumThreads:2,interOpNumThreads:1,enableCpuMemArena:false},
    });
  })();
  return instance;
}

const protectedToken=/https?:\/\/[^\s<>"']+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\d+(?:[.,:/-]\d+)*%?|PazarTarla|VakıfBank|Ziraat Bankası|Halkbank|(?<!\p{L})(?:dönüm|dekar|m²|m2|kg|ton|litre|TRY|USD|EUR|TL)(?!\p{L})/giu;
export function protectedValues(text){return [...text.matchAll(protectedToken)].map(m=>m[0]);}
const unchanged=text=>!/\p{L}/u.test(text)||/^https?:\/\/\S+$/.test(text);
export function splitText(text,limit=420){
  const parts=[];
  for(const paragraph of text.split(/(\n+)/)){
    if(/^\n+$/.test(paragraph)){parts.push({literal:paragraph});continue;}
    let current='';
    for(const word of paragraph.split(/(\s+)/)){
      if(current.length+word.length>limit&&current){parts.push({text:current});current='';}
      current+=word;
    }
    if(current)parts.push({text:current});
  }
  return parts;
}

async function rawBatch(texts){
  if(!texts.length)return [];
  const model=await translator();
  const output=[];
  // Seq2seq pipelines pad the supplied array together: do not pass an entire
  // article batch, even with batch_size, or decoder tensors can exhaust RAM.
  for(let offset=0;offset<texts.length;offset+=2){
    const result=await model(texts.slice(offset,offset+2),{max_new_tokens:192,num_beams:1});
    for(const value of result){
      const translated=String(value.translation_text||'').trim();
      if(!translated)throw new Error(`Empty local translation at batch index ${offset}`);
      output.push(translated);
    }
  }
  return output;
}

const fragmentCache=new Map();
/** Protect immutable values BEFORE inference, and reuse repeated bank/legal text. */
export async function translateBatch(texts){
  const jobs=[],pending=new Map(),plans=[];
  const append=(parts,text)=>{
    for(const part of splitText(text)){
      if(part.literal!==undefined){parts.push(part);continue;}
      const key=part.text.trim();
      if(!key||unchanged(key)){parts.push({literal:part.text});continue;}
      if(!fragmentCache.has(key)&&!pending.has(key)){pending.set(key,jobs.length);jobs.push(key);}
      parts.push({key,leading:part.text.match(/^\s*/)[0],trailing:part.text.match(/\s*$/)[0]});
    }
  };
  for(const original of texts){
    const parts=[];let cursor=0;
    for(const match of original.matchAll(protectedToken)){
      append(parts,original.slice(cursor,match.index));
      parts.push({literal:match[0]});cursor=match.index+match[0].length;
    }
    append(parts,original.slice(cursor));plans.push(parts);
  }
  const output=await rawBatch(jobs);
  for(let i=0;i<jobs.length;i++)fragmentCache.set(jobs[i],output[i]);
  return plans.map(parts=>parts.map(part=>part.literal??`${part.leading}${fragmentCache.get(part.key)}${part.trailing}`).join(''));
}
