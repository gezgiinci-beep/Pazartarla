import test from 'node:test';
import assert from 'node:assert/strict';
import {LISTING_META_MARKER,legacyListingMetadata,readListingMedia,imageData,
  persistListingImages,listingImageUrl,mediaReference,assertSavedMedia} from '../src/lib/listingMedia.mjs';
const url='https://example.supabase.co';
const userId='00000000-0000-4000-8000-000000000001';
const photo='data:image/png;base64,iVBORw0KGgo=';
const legacy={seotags:'  Türkçe, tarım  '+LISTING_META_MARKER+
  encodeURIComponent(JSON.stringify({images:[photo,'https://example.org/old.jpg'],isFeatured:true})),image:photo};
test('legacy decode preserves exact SEO prefix and ordered photos; typed fields take precedence',()=>{
  const parsed=legacyListingMetadata(legacy);
  assert.equal(parsed.seoTags,'  Türkçe, tarım  ');
  assert.deepEqual(parsed.images,[photo,'https://example.org/old.jpg']);
  assert.equal(parsed.isFeatured,true);
  const typed=readListingMedia({...legacy,gallery_paths:[],is_featured:false},url);
  assert.deepEqual(typed.images,[]);
  assert.equal(typed.isFeatured,false);
  assert.throws(()=>legacyListingMetadata({seotags:'KEEP'+LISTING_META_MARKER+'%XX'}));
  assert.deepEqual(legacyListingMetadata({seotags:null,image:'https://example.org/old.jpg'}).images,['https://example.org/old.jpg']);
});
test('storage upload replaces bytes with paths and reuses successful upload on retry',async()=>{
  let calls=0;
  const client={storage:{from(bucket){assert.equal(bucket,'listing-media');return {
    async upload(path,blob,options){calls++;assert.ok(blob instanceof Blob);
      assert.equal(options.upsert,false);assert.match(path,new RegExp('^'+userId+'/'));return {data:{path},error:null};}
  };}}};
  const saved=await persistListingImages([photo,'https://example.org/old.jpg'],{client,baseUrl:url,userId});
  assert.equal(calls,1);
  assert.ok(saved.gallery_paths[0].startsWith('listing-media/'));
  assert.ok(!JSON.stringify(saved).includes('data:image'));
  assert.equal(saved.image,listingImageUrl(saved.gallery_paths[0],url));
  assert.equal(mediaReference(saved.image,url),saved.gallery_paths[0]);
  assert.deepEqual(await persistListingImages([photo,'https://example.org/old.jpg'],{client,baseUrl:url,userId}),saved);
  assert.equal(calls,1);
});
test('reject unsafe references, oversized bytes and spoofed/unsupported images before mutation',async()=>{
  for(const image of ['data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,YWJj','data:text/html;base64,YWJj'])
    assert.throws(()=>imageData(image));
  assert.throws(()=>imageData(photo,2));
  for(const ref of ['javascript:alert(1)','blob:x','http://example.org/image','listing-media/../bad','https://user:pass@example.org/image'])
    assert.throws(()=>mediaReference(ref,url));
  await assert.rejects(()=>persistListingImages(new Array(11).fill(photo),{client:{},baseUrl:url,userId}));
  await assert.rejects(()=>persistListingImages([photo],{client:{},baseUrl:url,userId:''}));
});
test('partial failure retains earlier upload and never sends bytes to a listing writer',async()=>{
  const otherUser='00000000-0000-4000-8000-000000000002';
  const second='data:image/gif;base64,R0lGODlh';
  let calls=0,fail=true;
  const client={storage:{from(){return {async upload(path){
    calls++;return {data:{path},error:calls===2 && fail ? new Error('upload failed') : null};
  }};}}};
  await assert.rejects(()=>persistListingImages([photo,second],{client,baseUrl:url,userId:otherUser}));
  fail=false;
  const saved=await persistListingImages([photo,second],{client,baseUrl:url,userId:otherUser});
  assert.equal(calls,3);
  assert.equal(saved.gallery_paths.length,2);
});
test('mutation acknowledgement must include the exact dedicated field values',()=>{
  assertSavedMedia({is_featured:false,gallery_paths:[]},{is_featured:false,gallery_paths:[]});
  assert.throws(()=>assertSavedMedia({seotags:'legacy'},{is_featured:false}));
  assert.throws(()=>assertSavedMedia({gallery_paths:['wrong']},{gallery_paths:['expected']}));
});