import assert from 'node:assert/strict';
import test from 'node:test';
import {parseStoreData,storeIdFromUrl,storeRpc} from '../src/lib/storeMembership.ts';
const id='00000000-0000-4000-8000-000000000001';
const plan={id:'package-1',name:'Paket 1',monthly_price_try:350,monthly_limit:30,active_limit:100};
const store={id,name:'Synthetic',description:'Test',revision:1,listing_ids:[1]};
const valid=()=>({plans:[plan],stores:[store],store,listings:[{id:1,title:'Test',status:'approved'}],mine:null,requests:[]});
test('Server plans keep monthly new submissions and simultaneous capacity distinct',()=>{
  const d=parseStoreData(valid());assert.equal(d.plans[0].monthly_limit,30);assert.equal(d.plans[0].active_limit,100);
});
test('Invalid or incomplete response fails explicitly rather than inventing plans',()=>{
  for(const data of [{},{...valid(),plans:[{...plan,monthly_price_try:'350'}]},{...valid(),plans:[{...plan,monthly_price_try:Infinity}]},{...valid(),stores:[{...store,revision:undefined}]},{...valid(),listings:[null]},{...valid(),listings:[{id:1,title:'Hidden',status:'pending'}]}])
    assert.throws(()=>parseStoreData(data),/geçerli veri/);
});
test('Stable public store URL reloads independently of session',()=>{
  assert.equal(storeIdFromUrl('https://example.invalid/?magaza='+id),id);
  for(const url of ['https://example.invalid/','https://example.invalid/?magaza=bad','invalid'])
    assert.equal(storeIdFromUrl(url),null);
});
test('RPC sends server revision/id with private session header; errors are visible',async()=>{
  let input;
  const result=await storeRpc('https://example.invalid/',{Authorization:'Bearer synthetic-only'},'manage_store_membership',{p_action:'approve',p_id:id,p_revision:3,p_payload:{payment_confirmed:true}},async(url,options)=>{
    input={url,options};return new Response('{"ok":true}',{status:200});
  });
  assert.equal(result.ok,true);assert.match(input.url,/\/rest\/v1\/rpc\/manage_store_membership$/);
  assert.equal(JSON.parse(input.options.body).p_revision,3);assert.equal(input.options.cache,'no-store');
  for(const [message,text] of [['MEMBERSHIP_PAYMENT_USED',/ikinci üyelik/],['MEMBERSHIP_ACTIVE_LIMIT',/kapasitesini aşıyor/],['MEMBERSHIP_STALE',/eski sürüm/]])
    await assert.rejects(()=>storeRpc('https://example.invalid',{},'manage_store_membership',{},async()=>new Response(JSON.stringify({message}),{status:400})),text);
  await assert.rejects(()=>storeRpc('https://example.invalid',{},'get_store_membership_data',{},async()=>new Response('{}',{status:404})),/altyapısı kurulmamış/);
});