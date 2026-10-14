import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { storeIdFromUrl, storeUrl, storeRpc } from '../src/lib/storeMembership.ts';
import { readPublicNavigation } from '../src/lib/publicNavigation.mjs';

const id='abcdef01-2345-4000-8000-000000000001';
const base='https://example.invalid/pazartarla/';

test('shared store URLs retain the artifact path, normalize IDs and exclude unrelated private parameters',()=>{
  const href=storeUrl(id.toUpperCase(),base+'?ilan=42&teklifler=1&token=private-test#detail');
  assert.equal(href,base+'?magaza='+id);
  assert.equal(storeIdFromUrl(href),id);
  assert.deepEqual(readPublicNavigation(href),{tab:'store',storeId:id,listingId:null,invalidStoreLink:false});
});

test('opening a store keeps unrelated navigation parameters and removes conflicting selections',()=>{
  const href=storeUrl(id,base+'?utm_source=test&ilan=42&teklifler=1&demo_magaza=demo-bereket&demo_ilan=demo-product-1',true);
  const params=new URL(href).searchParams;
  assert.equal(params.get('utm_source'),'test');
  assert.equal(params.get('magaza'),id);
  for(const name of ['ilan','teklifler','demo_magaza','demo_ilan'])assert.equal(params.has(name),false);
});

test('reload and history navigation use the same selection precedence',()=>{
  const store=base+'?magaza='+id;
  for(const state of [undefined,{tab:'home'},{tab:'offers'},{tab:'detail'}]){
    assert.equal(readPublicNavigation(store,state).tab,'store');
    assert.equal(readPublicNavigation(store,state).storeId,id);
  }
  const both=readPublicNavigation(store+'&ilan=42',{tab:'store'});
  assert.equal(both.tab,'detail');assert.equal(both.listingId,'42');assert.equal(both.storeId,null);
  assert.equal(readPublicNavigation(base+'?teklifler=1',{tab:'home'}).tab,'offers');
  for(const tab of ['store','detail'])assert.equal(readPublicNavigation(base,{tab}).tab,'home');
  assert.equal(readPublicNavigation(base,{tab:'memberships'}).tab,'memberships');
});

test('the direct /admin path opens the existing login gate, not the protected panel',()=>{
  assert.deepEqual(readPublicNavigation('https://www.pazartarla.com.tr/admin'),{
    tab:'admin-page',storeId:null,listingId:null,invalidStoreLink:false,
  });
  assert.deepEqual(readPublicNavigation('https://www.pazartarla.com.tr/pazartarla/admin'),{
    tab:'admin-page',storeId:null,listingId:null,invalidStoreLink:false,
  });
});

test('invalid and ambiguous store parameters show an explicit invalid-link state',()=>{
  for(const query of ['magaza=bad','magaza=','magaza='+id+'&magaza='+id]){
    const route=readPublicNavigation(base+'?'+query);
    assert.equal(route.tab,'store');assert.equal(route.storeId,null);assert.equal(route.invalidStoreLink,true);
  }
  assert.equal(storeIdFromUrl(base+'?magaza='+id.toUpperCase()),id);
  assert.throws(()=>storeUrl('bad',base),/geçerli bir mağaza/);
});

test('missing or malformed server configuration makes no network request',async()=>{
  let calls=0;
  const request=async()=>{calls++;throw Error('Unexpected request');};
  for(const url of [undefined,null,'','   ','undefined','javascript:alert(1)','https://user:password@example.invalid']){
    await assert.rejects(storeRpc(url,{},'get_store_membership_data',{},request),/VITE_SUPABASE_URL/);
  }
  assert.equal(calls,0);
  let target='';
  await storeRpc(' https://example.invalid/// ',{},'get_store_membership_data',{},
    async url=>{target=url;return new Response('{}',{status:200});});
  assert.equal(target,'https://example.invalid/rest/v1/rpc/get_store_membership_data');
});

test('App has one native history resolver rather than competing store and listing listeners',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/readPublicNavigation\(window\.location\.href,event\.state\)/);
  assert.equal((app.match(/window\.addEventListener\('popstate'/g)||[]).length,1);
  assert(!app.includes('const syncStore='));
  assert.match(app,/invalidLink=\{invalidStoreLink\}/);
});
