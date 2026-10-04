import test from 'node:test';
import assert from 'node:assert/strict';
import {listingDraft,listingChanges,editError} from '../src/lib/listingEditor.ts';
import {readModerationRows,saveModerationSnapshot} from '../src/lib/moderationRequests.ts';
import {readFileSync} from 'node:fs';
const row={id:5,title:'Original',price:150,category:'Mahsuller',subCategory:'Ceviz',location:null,description:'Desc',seller:'Seller',phone:'+12025550100',image:'KEEP',submitted_by:'KEEP',status:'approved'};
test('only changed allowlisted fields; identity/media/state never copied from full row',()=>{
  const draft=listingDraft(row);
  assert.deepEqual(listingChanges(row,draft),{});
  assert.deepEqual(listingChanges(row,{...draft,price:'175',title:'Corrected',id:'6',image:'REPLACE'}),{title:'Corrected',price:175});
  assert.deepEqual(listingChanges(row,{...draft,description:''}),{description:''});
  const legacy={...row,title:' Original ',description:'  Preserved spacing  '};
  assert.deepEqual(listingChanges(legacy,listingDraft(legacy)),{});
});
test('invalid prices fail and permission/conflict/deployment/network errors stay explicit',()=>{
  for(const price of ['','abc','-1','Infinity'])assert.throws(()=>listingChanges(row,{...listingDraft(row),price}));
  assert.match(editError({code:'40001'}),/Taslağınız korundu/);
  assert.match(editError({code:'42501'}),/yetkiniz yok/);
  assert.match(editError({code:'PGRST202'}),/etkinleştirilmemiş/);
  assert.match(editError(new Error('network')),/Taslağınız korundu/);
});
test('moderation preserves rendered snapshot token and rejects stale server decision',async()=>{
  const token='a'.repeat(64);
  assert.equal(readModerationRows([{listing:{id:5,status:'pending'},edit_token:token}],r=>r)[0]._editToken,token);
  assert.throws(()=>readModerationRows([{listing:{id:5}}],r=>r));
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async(url,options)=>{
      assert.match(url,/rpc\/moderate_listing_snapshot$/);
      assert.equal(options.method,'POST');
      assert.deepEqual(JSON.parse(options.body),{p_listing_id:5,p_decision:'approved',p_edit_token:token});
      return new Response(JSON.stringify({code:'40001'}),{status:409});
    };
    await assert.rejects(()=>saveModerationSnapshot('https://example.invalid',{},5,'approved',token));
    globalThis.fetch=async()=>new Response(JSON.stringify({listing:{id:5,status:'approved'}}));
    assert.equal((await saveModerationSnapshot('https://example.invalid',{},5,'approved',token)).status,'approved');
  }finally{globalThis.fetch=originalFetch;}
});
test('gallery path only submits media fields with opened server snapshot token; card forwards displayed token',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const save=app.slice(app.indexOf('const saveEditedListing ='),app.indexOf('const saveEditedListing =')+4000);
  assert.match(save,/rpc\('update_listing_media'/);
  assert.match(save,/p_edit_token:editingListing\._editToken/);
  assert.match(save,/p_changes:\{image:updatedListing.image,seotags:serializeListingTags\(updatedListing\)\}/);
  assert.doesNotMatch(save,/method: 'PATCH'/);
  const card=readFileSync(new URL('../src/components/ModerationQueue.tsx',import.meta.url),'utf8');
  assert.match(card,/decide\(id, "approved", item\._editToken\)/);
  assert.match(card,/decide\(id, "rejected", item\._editToken\)/);
});