import {adFile,adFields,AdConflictError} from './advertisements.ts';
import type {Advertisement,AdvertisementDraft} from './advertisements';
type Pending={id:string,path:string,file:File,revision:number,oldPath:string};
type Operations={
  read:(id:string)=>Promise<Advertisement|null>;
  prepare:(file:File)=>Promise<File>;
  upload:(path:string,file:File)=>Promise<void>;
  patch:(ad:Advertisement,fields:Record<string,unknown>)=>Promise<Advertisement>;
  orphan:(path:string)=>void;
};
export async function replaceAdAsset(input:AdvertisementDraft, pending:{current:Pending|null},ops:Operations) {
  const ad=input.existing,file=input.file;
  if(!ad||!file)throw new Error('Güncellenecek kayıt ve görsel seçilmelidir.');
  adFile(file);
  const fields=adFields(input.title,input.target_url,input.is_active);
  const matches=(row:Advertisement,path:string)=>row.id===ad.id&&row.revision>ad.revision&&row.media_path===path&&row.title===fields.title&&row.target_url===fields.target_url&&row.is_active===fields.is_active;
  if(pending.current){
    const previous=pending.current;
    const row=await ops.read(previous.id);
    if(row?.media_path===previous.path){
      pending.current=null;
      if(previous.id===ad.id&&matches(row,previous.path))return {row,obsoletePath:previous.oldPath};
      throw new AdConflictError();
    }
    if(!row||row.revision!==previous.revision){
      pending.current=null;ops.orphan(previous.path);
      throw new AdConflictError();
    }
    if(previous.id!==ad.id||previous.file!==file||previous.revision!==ad.revision)
      throw new Error('Önceki görsel kaydı belirsiz. Aynı taslak ve dosyayla yeniden deneyin.');
  }
  if(!pending.current){
    const current=await ops.read(ad.id);
    if(!current||current.revision!==ad.revision)throw new AdConflictError();
    const prepared=await ops.prepare(file),kind=adFile(prepared);
    const path=ad.id+'/'+crypto.randomUUID()+'.'+kind.extension;
    await ops.upload(path,prepared);
    pending.current={id:ad.id,path,file,revision:ad.revision,oldPath:ad.media_path};
  }
  const snapshot=pending.current;
  const extension=snapshot.path.split('.').pop();
  const media_type=['mp4','webm'].includes(extension!)?'video':'image';
  try{
    const row=await ops.patch(ad,{...fields,media_path:snapshot.path,media_type});
    if(!matches(row,snapshot.path)||row.media_type!==media_type)throw new Error('Görsel kaydı sunucudan doğrulanamadı.');
    pending.current=null;
    return {row,obsoletePath:snapshot.oldPath};
  }catch(error){
    try{
      const row=await ops.read(ad.id);
      if(row?.media_path===snapshot.path){
        pending.current=null;
        if(matches(row,snapshot.path)&&row.media_type===media_type)return {row,obsoletePath:snapshot.oldPath};
        throw new AdConflictError();
      }
      if(!row||row.revision!==snapshot.revision){
        pending.current=null;ops.orphan(snapshot.path);
      }
    }catch(readError){
      if(readError instanceof AdConflictError)throw readError;
      // Unknown commit outcome: retain the uploaded object and reuse it on retry.
    }
    throw error;
  }
}