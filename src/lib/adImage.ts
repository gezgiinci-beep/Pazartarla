import {adFile} from './advertisements.ts';
// New uploads only. Existing sponsor originals and unrelated listing media stay untouched.
export async function optimizeAdImage(file: File): Promise<File> {
  if(adFile(file).media_type!=='image')return file;
  const bitmap=await createImageBitmap(file);
  try {
    const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Görsel işlenemedi. Başka bir görsel deneyin.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Görsel işlenemedi.')),'image/webp',0.9));
    if(scale===1&&blob.size>=file.size)return file;
    const type=blob.type;
    if(!['image/webp','image/png','image/jpeg'].includes(type))throw new Error('Görsel kodlaması desteklenmiyor.');
    const output=new File([blob],file.name,{type,lastModified:file.lastModified});
    adFile(output);
    return output;
  }finally{bitmap.close();}
}