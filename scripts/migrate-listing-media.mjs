// Operator-only. No startup/build hook; default mode is a read-only dry run.
import {readFile} from 'node:fs/promises';
import {rootCertificates} from 'node:tls';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {databaseTarget,PRODUCTION_REF} from './safety/database-target.mjs';
import {createBackup} from './safety/backup.mjs';
import {listingMediaPlan,sha256,ensureMigrationObject,verifyObject} from './safety/listing-media-plan.mjs';
import {LISTING_META_MARKER,LISTING_MEDIA_BUCKET,mediaReference} from '../src/lib/listingMedia.mjs';
const mode=process.argv[2] || '--dry-run';
let client;
try {
  if(!['--dry-run','--apply','--verify'].includes(mode))throw Error('Unsupported mode.');
  const baseUrl=`https://${PRODUCTION_REF}.supabase.co`;
  const sourceFiles=['scripts/migrate-listing-media.mjs','scripts/safety/listing-media-plan.mjs',
    'src/lib/listingMedia.mjs','supabase/reviewed_changes/20261004_listing_media_expand.sql',
    'supabase/reviewed_changes/20261004_listing_media_finalize.sql'];
  const hash=sha256((await Promise.all(sourceFiles.map(path=>readFile(new URL('../'+path,import.meta.url),'utf8')))).join('\n'));
  console.log('Reviewed media change hash:',hash);
  const url=databaseTarget(process.env.SUPABASE_DATABASE_URL,PRODUCTION_REF);
  if(!process.env.SUPABASE_DATABASE_CA_FILE)throw Error('Verified database CA file required.');
  const applying=mode==='--apply';
  if(applying && process.env.PAZARTARLA_MEDIA_APPROVAL!==`production:${PRODUCTION_REF}:${hash}`)
    throw Error('Explicit reviewed media-change approval required.');
  if(applying && process.env.PAZARTARLA_MEDIA_WRITERS_READY!=='verified')
    throw Error('Verify every serving frontend writer uses typed media fields first.');
  // New successful encrypted backup for EACH apply, never a caller-written receipt.
  if(applying)await createBackup();
  if(mode!=='--dry-run' && !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error('Operator Storage credential must be configured securely.');
  const storage=mode==='--dry-run'?null:createClient(baseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}}).storage.from(LISTING_MEDIA_BUCKET);
  client=new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15000,
    ssl:{ca:[...rootCertificates,await readFile(process.env.SUPABASE_DATABASE_CA_FILE,'utf8')],rejectUnauthorized:true}});
  await client.connect();
  await client.query("SET timezone='UTC'; SET statement_timeout='30s'; SET lock_timeout='5s'");
  if(!applying)await client.query('SET default_transaction_read_only=on');
  let afterId=-1,count=0,uploadCount=0,alreadyTyped=0;
  while(true) {
    const batch=(await client.query(`SELECT to_jsonb(l) row,
      encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex') token
      FROM public.listings l WHERE id>$1 ORDER BY id LIMIT 25`,[afterId])).rows;
    if(!batch.length)break;
    for(const {row,token} of batch) {
      afterId=row.id;
      const plan=listingMediaPlan(row,baseUrl);
      count++;uploadCount+=plan.uploads.size;
      if(row.gallery_paths!=null && row.is_featured!=null)alreadyTyped++;
      if(mode==='--dry-run')continue;
      if(mode==='--verify') {
        if(row.gallery_paths==null || row.is_featured==null || plan.uploads.size ||
          (row.seotags || '').includes(LISTING_META_MARKER) ||
          row.image?.startsWith('data:') || row.image?.startsWith('blob:'))
          throw Error('LISTING_MEDIA_BACKFILL_NOT_VERIFIED');
        for(const path of row.gallery_paths) {
          const ref=mediaReference(path,baseUrl);
          if(ref.startsWith(LISTING_MEDIA_BUCKET+'/')) {
            const objectPath=ref.slice(LISTING_MEDIA_BUCKET.length+1);
            const digest=/^migrated\/[0-9]+\/([a-f0-9]{64})\.(jpg|png|gif|webp)$/.exec(objectPath);
            if(digest)await verifyObject(storage,objectPath,digest[1]);
            else {
              const {data,error}=await storage.download(objectPath);
              if(error || !data || !data.size)throw Error('LISTING_MEDIA_OBJECT_VERIFICATION_FAILED');
            }
          }
        }
        continue;
      }
      for(const [path,file] of plan.uploads)await ensureMigrationObject(storage,path,file);
      // Download/hash verification has succeeded BEFORE metadata is removed.
      // Lock and compare the entire original row so no concurrent correction,
      // moderation or SEO/gallery change can be overwritten.
      await client.query('BEGIN');
      try {
        const fresh=(await client.query(`SELECT encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex') token
          FROM public.listings l WHERE id=$1 FOR UPDATE`,[row.id])).rows[0];
        if(fresh?.token!==token)throw Error('LISTING_MEDIA_CONCURRENT_CHANGE_RETRY');
        await client.query('SELECT private.validate_listing_gallery($1::text[],false)',[plan.changes.gallery_paths]);
        const saved=(await client.query(`UPDATE public.listings SET gallery_paths=$2::text[],is_featured=$3,image=$4,seotags=$5
          WHERE id=$1 RETURNING to_jsonb(listings) row`,[row.id,plan.changes.gallery_paths,
          plan.changes.is_featured,plan.changes.image,plan.changes.seotags])).rows[0].row;
        for(const [key,value] of Object.entries(row))
          if(!Object.hasOwn(plan.changes,key) && JSON.stringify(saved[key])!==JSON.stringify(value))
            throw Error('LISTING_MEDIA_PROTECTED_FIELD_CHANGED');
        for(const [key,value] of Object.entries(plan.changes))
          if(JSON.stringify(saved[key])!==JSON.stringify(value))throw Error('LISTING_MEDIA_READBACK_FAILED');
        if(sha256(JSON.stringify(saved.seotags))!==plan.seoHash)throw Error('LISTING_MEDIA_SEO_CHANGED');
        await client.query('COMMIT');
      }catch(error){await client.query('ROLLBACK');throw error;}
    }
  }
  console.log(JSON.stringify({mode,listings:count,inlineObjects:uploadCount,alreadyTyped}));
  if(applying)console.log('Backfill completed. Run --verify before reviewing the final constraint phase.');
}catch(error){
  // Never output provider/SQL errors containing row data, image bytes or credentials.
  console.error('MEDIA MIGRATION STOPPED:',error.code || (
    /^LISTING_MEDIA_[A-Z_]+$/.test(error.message)?error.message:'Check operator prerequisites and private diagnostics.'));
  process.exitCode=1;
}finally{if(client)await client.end();}