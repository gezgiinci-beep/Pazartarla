import test from 'node:test';
import assert from 'node:assert/strict';
import {setListingFeatured,featuredError} from '../src/lib/listingFeatured.mjs';
const token='a'.repeat(64);
test('featured removal uses narrow RPC and displayed intent, never rewrites SEO/photos',async()=>{
  const calls=[];
  const client={rpc:async(name,args)=>{
    calls.push([name,args]);
    return name==='get_listing_featured_snapshot'
      ?{data:{listing:{id:7,seotags:'KEEP',image:'KEEP'},edit_token:token}}
      :{data:{listing:{id:7,is_featured:false,seotags:'KEEP',image:'KEEP'}}};
  }};
  assert.equal((await setListingFeatured(client,7,false)).is_featured,false);
  assert.deepEqual(calls,[
    ['get_listing_featured_snapshot',{p_listing_id:7}],
    ['set_listing_featured',{p_listing_id:7,p_featured:false,p_edit_token:token}]
  ]);
});
test('missing RPC, invalid readback, auth and conflicts fail without fallback',async()=>{
  for(const code of ['PGRST202','42501','40001']){
    let calls=0;
    await assert.rejects(()=>setListingFeatured({rpc:async()=>{calls++;return{error:{code}};}},7,false));
    assert.equal(calls,1);
  }
  await assert.rejects(()=>setListingFeatured({rpc:async()=>({data:{listing:{id:7},edit_token:'bad'}})},7,false));
  await assert.rejects(()=>setListingFeatured({rpc:async(name)=>({data:name==='get_listing_featured_snapshot'
    ?{listing:{id:7},edit_token:token}:{listing:{id:7,is_featured:true}}})},7,false));
  assert.match(featuredError({code:'PGRST202'}),/ilan onayı isteği değildir/);
  assert.match(featuredError({code:'42501'}),/yönetici oturumu/);
  assert.match(featuredError({code:'40001'}),/başka bir oturum/);
});
