import {readFile,writeFile,mkdir,readdir,rename,open,unlink,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {fetchPublicSources,publicTranslationTexts,sourceRevision,sourceHash} from './public-source.mjs';
import {translateBatch,MODEL,MODEL_LICENSE} from './translator.mjs';
import {glossary} from './glossary.mjs';
import ts from 'typescript';

export const cacheFile=fileURLToPath(new URL('../../../generated-artifacts/site-english/catalog.json',import.meta.url));
const root=fileURLToPath(new URL('../../../',import.meta.url));
export async function readCatalog(filename=cacheFile){
  try{return JSON.parse(await readFile(filename,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
async function save(catalog,filename=cacheFile){
  await mkdir(path.dirname(filename),{recursive:true});
  await writeFile(filename+'.tmp',JSON.stringify(catalog));
  await rename(filename+'.tmp',filename);
}
export async function withCatalogLock(work,filename=cacheFile){
  const lock=filename+'.lock';
  await mkdir(path.dirname(lock),{recursive:true});
  let handle;
  for(let attempt=0;attempt<2;attempt++){
    try{
      handle=await open(lock,'wx');
      try{await handle.writeFile(JSON.stringify({pid:process.pid}));}
      catch(error){await handle.close();handle=null;await unlink(lock).catch(()=>{});throw error;}
      break;
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      let owner;
      try{owner=JSON.parse(await readFile(lock,'utf8'));}
      catch{
        const info=await stat(lock).catch(()=>null);
        if(info&&Date.now()-info.mtimeMs>15*60*1000){await unlink(lock).catch(()=>{});continue;}
        return {busy:true};
      }
      if(!Number.isSafeInteger(owner.pid)||owner.pid<1)return {busy:true};
      try{process.kill(owner.pid,0);return {busy:true};}
      catch(check){if(check.code!=='ESRCH')return {busy:true};}
      await unlink(lock).catch(error=>{if(error.code!=='ENOENT')throw error;});
    }
  }
  if(!handle)return {busy:true};
  try{return await work();}
  finally{await handle.close();await unlink(lock).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
async function sourceFiles(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await sourceFiles(full));
    else if(/\.[cm]?[jt]sx?$/.test(entry.name))files.push(full);
  }
  return files;
}
export async function buildTranslationCatalog({
  previous,source,uiTexts=[],reviewed={},ui=true,onlyIfChanged=false,
  resumedDictionary={},translate=translateBatch,persist=async()=>{},onProgress=()=>{},
}){
  const uiRevision=sourceHash({uiTexts,reviewed,glossary});
  if(onlyIfChanged&&previous?.version===2&&previous.coverage.complete&&previous.coverage.uiIncluded
    &&previous.sourceRevision===sourceRevision(source)&&previous.uiRevision===uiRevision){
    const checked={...previous,lastCheckedAt:new Date().toISOString()};
    await persist(checked,true);return checked;
  }
  const dictionary=Object.assign(Object.create(null),previous?.dictionary,resumedDictionary,reviewed,glossary);
  for(const [original,translated]of Object.entries(dictionary)){
    if(['dönüm','dekar'].some(unit=>original.toLocaleLowerCase('tr').includes(unit)&&!translated.toLocaleLowerCase('tr').includes(unit)))delete dictionary[original];
  }
  const texts=[...publicTranslationTexts(source),...uiTexts];
  const unique=[...new Set(texts.filter(text=>typeof text==='string'&&text.trim()))];
  const missing=unique.filter(text=>!Object.hasOwn(dictionary,text));
  const catalog={
    version:2,model:MODEL,modelLicense:MODEL_LICENSE,uiRevision,
    uiKeys:[...new Set([...uiTexts,...Object.keys(reviewed),...Object.keys(glossary)])],
    machineTranslated:true,preparedAt:new Date().toISOString(),
    sourceRevision:sourceRevision(source),source,dictionary,
    coverage:{total:unique.length,translated:unique.length-missing.length,complete:false,uiIncluded:ui},
  };
  await persist(catalog,false);
  for(let offset=0;offset<missing.length;offset+=12){
    const batch=missing.slice(offset,offset+12),translated=await translate(batch);
    for(let i=0;i<batch.length;i++)dictionary[batch[i]]=translated[i];
    catalog.coverage.translated=Math.min(unique.length,unique.length-missing.length+offset+batch.length);
    await persist(catalog,false);
    if(offset%60===0)onProgress(`English catalog: ${catalog.coverage.translated}/${unique.length}`);
  }
  // A withdrawn public article must not remain readable in a JS dictionary.
  const required=new Set([...unique,...Object.keys(reviewed),...Object.keys(glossary)]);
  catalog.dictionary=Object.fromEntries([...required].filter(key=>Object.hasOwn(dictionary,key)).map(key=>[key,dictionary[key]]));
  catalog.coverage.complete=true;
  catalog.preparedAt=new Date().toISOString();
  catalog.lastCheckedAt=new Date().toISOString();
  await persist(catalog,true);
  onProgress(`English catalog ready: ${source.listings.length} listings, ${source.articles.length} articles, ${unique.length} text entries.`);
  return catalog;
}
export async function prepareCatalog({ui=true,refresh=true,onlyIfChanged=false,onProgress=console.log}={}){
  return withCatalogLock(async()=>{
    const previous=await readCatalog();
    const pending=await readCatalog(cacheFile+'.pending');
    const source=refresh||!previous?.source?await fetchPublicSources():previous.source;
    const reviewedSource=await readFile(new URL('../trade/src/lib/trade-locale.en.ts',import.meta.url),'utf8');
    const reviewedJs=ts.transpileModule(reviewedSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    const module={exports:{}};
    new Function('exports',reviewedJs)(module.exports);
    const reviewed=Object.fromEntries(Object.entries(module.exports.englishTradeCopy||{}).filter(([,value])=>typeof value==='string'));
    const uiTexts=[];
    if(ui){
      const {extractUiStrings}=await import('./ui-plugin.mjs');
      for(const directory of ['external/pazartarla/src','artifacts/pazartarla-gazete/src']){
        for(const filename of await sourceFiles(path.join(root,directory))){
          uiTexts.push(...extractUiStrings(await readFile(filename,'utf8'),filename));
        }
      }
    }
    return buildTranslationCatalog({
      previous,source,uiTexts,reviewed,ui,onlyIfChanged,resumedDictionary:pending?.dictionary,onProgress,
      persist:async(catalog,complete)=>{
        // Keep the last complete edition online while new content translates.
        await save(catalog,complete||!previous?.coverage.complete?cacheFile:cacheFile+'.pending');
        if(complete)await unlink(cacheFile+'.pending').catch(error=>{if(error.code!=='ENOENT')throw error;});
      },
    });
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  await prepareCatalog({ui:!process.argv.includes('--public-only'),refresh:!process.argv.includes('--cached-source'),onlyIfChanged:process.argv.includes('--refresh-if-changed')});
}
