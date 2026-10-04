import test from 'node:test';
import assert from 'node:assert/strict';
import {listingDraft,listingChanges,editError} from '../src/lib/listingEditor.ts';
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