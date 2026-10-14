import test from 'node:test';
import assert from 'node:assert/strict';
import {listingMediaPlan,ensureMigrationObject,sha256} from '../scripts/safety/listing-media-plan.mjs';
import {LISTING_META_MARKER} from '../src/lib/listingMedia.mjs';
const url='https://example.supabase.co';
const data='data:image/png;base64,iVBORw0KGgo=';
test('migration keeps exact SEO, photos, featured and non-media fields untouched',()=>{
  const row={id:9,seotags:' Türkçe, tag  '+LISTING_META_MARKER+
    encodeURIComponent(JSON.stringify({images:[data,'https://example.org/gallery.jpg'],isFeatured:true})),
    image:'https://example.org/cover.jpg',title:'KEEP',created_at:'KEEP',submitted_by:'KEEP'};
  const original=structuredClone(row),plan=listingMediaPlan(row,url);
  assert.deepEqual(row,original);
  assert.equal(plan.changes.seotags,' Türkçe, tag  ');
  assert.equal(plan.changes.is_featured,true);
  assert.equal(plan.changes.gallery_paths.length,3);
  assert.equal(plan.changes.gallery_paths[1],'https://example.org/gallery.jpg');
  assert.equal(plan.changes.gallery_paths[2],row.image);
  assert.equal(plan.uploads.size,1);
  assert.match(plan.changes.gallery_paths[0],/^listing-media\/migrated\/9\/[a-f0-9]{64}\.png$/);
  assert.equal(plan.seoHash,sha256(JSON.stringify(plan.changes.seotags)));
  const typed=listingMediaPlan({...row,...plan.changes},url);
  assert.deepEqual(typed.changes,plan.changes);
  assert.equal(typed.uploads.size,0);
});
test('null SEO stays null and malformed/overfull galleries never silently lose photos',()=>{
  assert.equal(listingMediaPlan({id:1,seotags:null,image:'https://example.org/a'},url).changes.seotags,null);
  assert.throws(()=>listingMediaPlan({id:1,seotags:LISTING_META_MARKER+'bad'},url));
  assert.throws(()=>listingMediaPlan({id:1,seotags:'',gallery_paths:Array(11).fill('https://example.org/a')},url));
});
test('migration verifies downloaded byte hash, including pre-existing objects; never overwrites',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10]),hash=sha256(bytes);
  let downloads=0;
  const storage={async upload(path,blob,options){assert.equal(options.upsert,false);return {error:{statusCode:'409'}};},
    async download(){downloads++;return {data:new Blob([bytes]),error:null};}};
  await ensureMigrationObject(storage,'migrated/9/a.png',{bytes,hash,contentType:'image/png'});
  assert.equal(downloads,1);
  storage.download=async()=>({data:new Blob(['wrong']),error:null});
  await assert.rejects(()=>ensureMigrationObject(storage,'migrated/9/a.png',{bytes,hash,contentType:'image/png'}));
});