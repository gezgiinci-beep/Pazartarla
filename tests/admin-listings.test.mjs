import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deleteAdminListing} from '../src/lib/adminListingRequests.ts';

test('deletion requires the exact server-confirmed row, never a silent RLS no-op',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async(url,options)=>{
      assert.match(url,/listings\?id=eq\.42$/);
      assert.equal(options.headers.Authorization,'Bearer synthetic');
      assert.equal(options.headers.Prefer,'return=representation');
      return new Response(JSON.stringify([{id:42}]));
    };
    await deleteAdminListing('https://example.invalid',{Authorization:'Bearer synthetic'},42);
    for(const body of [[],{},[{id:43}],[{id:42},{id:43}]]){
      globalThis.fetch=async()=>new Response(JSON.stringify(body));
      await assert.rejects(()=>deleteAdminListing('https://example.invalid',{},42));
    }
    for(const status of [204,401,403,500]){
      globalThis.fetch=async()=>new Response(null,{status});
      await assert.rejects(()=>deleteAdminListing('https://example.invalid',{},42));
    }
  }finally{globalThis.fetch=original;}
});

test('admin UI uses Auth and server permission with no PIN or localStorage gate',()=>{
  const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(source,/auth\.signInWithPassword/);
  assert.match(source,/rpc\('is_listing_admin'\)/);
  assert.match(source,/getAdminDbHeaders\(\), id/);
  assert.doesNotMatch(source,/(?:adminPin|ADMIN_PIN|adminPassword\s*===|localStorage\.setItem\(['"](?:admin|isAdmin))/i);
  const submit=source.slice(source.indexOf('const newEntry ='),source.indexOf('const newEntry =')+2200);
  assert.match(submit,/status: 'pending'/);
  assert.match(submit,/isFeatured: false/);
  assert.match(submit,/sessionData\.session\.access_token/);
});