import {createHash} from 'node:crypto';
import {legacyListingMetadata,imageData,mediaReference,listingImageUrl,
  LISTING_MEDIA_BUCKET,DEFAULT_LISTING_IMAGE} from '../../src/lib/listingMedia.mjs';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

// Pure plan: never mutates rows, logs source data or fetches arbitrary remote URLs.
export function listingMediaPlan(row, baseUrl) {
  const legacy=legacyListingMetadata(row);
  const source=Array.isArray(row.gallery_paths) ? [...row.gallery_paths] : [...legacy.images];
  // Preserve a differing original cover as well, rather than silently discarding it.
  if(row.gallery_paths==null && row.image && row.image!==DEFAULT_LISTING_IMAGE && !source.includes(row.image))
    source.push(row.image);
  if(source.length>10)throw Error('LISTING_MEDIA_MANUAL_REVIEW_REQUIRED');
  const uploads=new Map();
  const paths=source.map(value=>{
    if(!value.startsWith('data:'))return mediaReference(value,baseUrl);
    // Historic images can exceed today's 2 MB picker limit. Do not recompress
    // or throw them away; the dedicated migration bucket allows up to 20 MB.
    const file=imageData(value,20*1024*1024);
    const hash=sha256(file.bytes);
    const objectPath=`migrated/${row.id}/${hash}.${file.extension}`;
    uploads.set(objectPath,{...file,hash});
    return LISTING_MEDIA_BUCKET+'/'+objectPath;
  });
  const changes={gallery_paths:paths,
    is_featured:typeof row.is_featured==='boolean'?row.is_featured:legacy.isFeatured,
    image:paths[0]?listingImageUrl(paths[0],baseUrl):row.image || DEFAULT_LISTING_IMAGE,
    seotags:row.seotags===null && !legacy.hasSuffix ? null : legacy.seoTags};
  return {changes,uploads,seoHash:sha256(JSON.stringify(changes.seotags))};
}

export async function verifyObject(storage, path, hash) {
  const {data,error}=await storage.download(path);
  if(error || !data || sha256(new Uint8Array(await data.arrayBuffer()))!==hash)
    throw Error('LISTING_MEDIA_OBJECT_VERIFICATION_FAILED');
}

export async function ensureMigrationObject(storage,path,file) {
  const {error}=await storage.upload(path,new Blob([file.bytes],{type:file.contentType}),
    {contentType:file.contentType,upsert:false});
  // A previous attempt may have uploaded before an uncertain DB response.
  // Verify rather than overwriting or trusting the name alone.
  if(error && !['409','Duplicate'].includes(String(error.statusCode || error.error)))
    throw Error('LISTING_MEDIA_UPLOAD_FAILED');
  await verifyObject(storage,path,file.hash);
}