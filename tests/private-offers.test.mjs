import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const {buildSync}=createRequire(require.resolve('vite/package.json'))('esbuild');
function load(file,react=React){
  const code=buildSync({entryPoints:[fileURLToPath(new URL('../src/'+file,import.meta.url))],
    bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
  const module={exports:{}};
  const window={setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}};
  const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
  new Function('require','module','exports','window','document',code)(
    name=>name==='react'?react:require(name),module,module.exports,window,document);
  return module.exports;
}
const state={catalogIds:[1],ownerIds:[],settings:{},offers:[],messages:[],loading:false,busy:false,
  error:'',actionError:'',refresh:async()=>{},toggle:async()=>true,submit:async()=>true,respond:async()=>true,sendMessage:async()=>true};
const offer={id:'synthetic-offer',listing_id:1,title:'Synthetic product',role:'buyer',status:'pending',
  amount:900,counter_amount:null,quantity:'2 ton',note:'private-note',buyer_phone:null,seller_phone:null,
  created_at:'2026-10-01T12:00:00Z',updated_at:'2026-10-01T12:00:00Z'};
const listing={id:1,title:'Synthetic product',price:150,category:'Mahsuller',location:'Test'};
const noOp=()=>{};
const props={state,listings:[listing],ownListings:[],session:null,onOpenListing:noOp,onSignIn:noOp,onCreateListing:noOp,onBack:noOp};
const Catalog=load('components/OfferMarketplace.tsx').default;
const Controls=load('components/OfferListingControls.tsx').default;
const html=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

test('Public catalog never exposes private bids, even when the current user has bids',()=>{
  const rendered=html(Catalog,{...props,state:{...state,offers:[offer]}});
  assert.match(rendered,/card-offer-listing-1/);
  assert(!rendered.includes('900 TL'));
  assert(!rendered.includes('private-note'));
  assert(!rendered.includes('input-offer-message'));
});
test('Backend failure is an explicit error, not an empty or fake successful catalog',()=>{
  const rendered=html(Catalog,{...props,state:{...state,error:'Kurulum gerekli'}});
  assert.match(rendered,/Kurulum gerekli/);
  assert(!rendered.includes('card-offer-listing-1'));
  assert(!rendered.includes('status-offers-catalog-empty'));
});
test('Each product has its own default-off owner toggle; signed-out buyers must sign in',()=>{
  const owner=html(Controls,{listing,state:{...state,ownerIds:[1,2]},session:{user:{id:'owner'}},onSignIn:noOp,onViewOffers:noOp});
  assert.match(owner,/switch-offer-enabled-1/);
  assert(!owner.includes('switch-offer-enabled-2'));
  assert(!owner.includes('checked=""'));
  const visitor=html(Controls,{listing,state,session:null,onSignIn:noOp,onViewOffers:noOp});
  assert.match(visitor,/button-offer-signin-1/);
  assert(!visitor.includes('input-offer-phone-1'));
  assert.equal(html(Controls,{listing,state:{...state,catalogIds:[]},session:null,onSignIn:noOp,onViewOffers:noOp}),'');
});
test('Phone input is required, and an existing open offer replaces the duplicate-offer form',()=>{
  const values={listing,state,session:{user:{id:'buyer'}},onSignIn:noOp,onViewOffers:noOp};
  assert.match(html(Controls,values),/type="tel"[^>]*required=""/);
  const existing=html(Controls,{...values,state:{...state,offers:[offer]}});
  assert(!existing.includes('button-offer-submit-1'));
  assert.match(existing,/yanıt bekleyen teklifiniz var/);
});
test('Only accepted offers render messaging and both contact paths; messages are escaped',()=>{
  const mineReact={...React,useState:initial=>React.useState(initial==='catalog'?'mine':initial)};
  const Mine=load('components/OfferMarketplace.tsx',mineReact).default;
  const pending=html(Mine,{...props,session:{user:{id:'buyer'}},state:{...state,offers:[offer]}});
  assert(!pending.includes('link-offer-tel'));
  assert(!pending.includes('input-offer-message'));
  const accepted=html(Mine,{...props,session:{user:{id:'buyer'}},state:{...state,
    offers:[{...offer,status:'accepted',buyer_phone:'+12025550111',seller_phone:'+12025550100'}],
    messages:[{id:'message',offer_id:offer.id,actor:'seller',body:'<script>no</script>',created_at:offer.created_at}]}});
  assert.match(accepted,/link-offer-tel-synthetic-offer/);
  assert.match(accepted,/link-offer-whatsapp-synthetic-offer/);
  assert.match(accepted,/input-offer-message-synthetic-offer/);
  assert(accepted.includes('&lt;script&gt;no&lt;/script&gt;'));
  assert(!accepted.includes('<script>'));
});
test('Seller receives accept/reject/counter actions, counteroffer buyer receives accept/reject',()=>{
  const mineReact={...React,useState:initial=>React.useState(initial==='catalog'?'mine':initial)};
  const Mine=load('components/OfferMarketplace.tsx',mineReact).default;
  const seller=html(Mine,{...props,session:{user:{id:'seller'}},state:{...state,offers:[{...offer,role:'seller'}]}});
  for(const key of ['button-offer-accept-','button-offer-decline-','button-offer-counter-'])assert(seller.includes(key));
  const countered=html(Mine,{...props,session:{user:{id:'buyer'}},state:{...state,offers:[{...offer,status:'countered',counter_amount:950}]}});
  assert(countered.includes('button-offer-buyer-accept-'));
  assert(countered.includes('button-offer-buyer-decline-'));
});
test('Private state is hidden immediately on account change; late previous-user responses cannot restore it',async()=>{
  const cells=[],refs=[],effects=[];
  let si=0,ri=0,schedule=false,cleanup;
  const react={
    useState(initial){const index=si++;if(!(index in cells))cells[index]=typeof initial==='function'?initial():initial;
      return[cells[index],value=>{cells[index]=typeof value==='function'?value(cells[index]):value;}];},
    useRef(initial){const index=ri++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
    useCallback:fn=>fn,useEffect(fn){if(schedule)effects.push(fn);},
  };
  const hook=load('hooks/useOffers.ts',react).useOffers;
  const sessionA={user:{id:'buyer-a'},access_token:'synthetic-a'};
  const sessionB={user:{id:'buyer-b'},access_token:'synthetic-b'};
  let currentSession=sessionA,delay=false,resolveOld;
  const userData=uid=>({owner_ids:[1],settings:[{listing_id:1,enabled:true}],
    offers:[{...offer,id:uid,amount:uid==='buyer-a'?900:950}],messages:[]});
  const client={auth:{getSession:async()=>({data:{session:currentSession},error:null})},
    rpc:async name=>name==='get_offer_catalog'?{data:[1],error:null}:delay?
      new Promise(resolve=>{resolveOld=resolve;}):{data:userData(currentSession.user.id),error:null}};
  function render(session,runEffect=false){
    si=0;ri=0;schedule=runEffect;
    const result=hook(client,session);
    if(runEffect){if(cleanup)cleanup();cleanup=effects.pop()();}
    return result;
  }
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  render(sessionA,true);await tick();
  let a=render(sessionA);assert.equal(a.offers[0].id,'buyer-a');
  delay=true;const oldRead=a.refresh();await tick();
  currentSession=sessionB;
  const beforeEffect=render(sessionB);
  assert.deepEqual(beforeEffect.offers,[]);
  assert.deepEqual(beforeEffect.messages,[]);
  assert.deepEqual(beforeEffect.ownerIds,[]);
  assert.deepEqual(beforeEffect.settings,{});
  delay=false;render(sessionB,true);await tick();
  resolveOld({data:userData('buyer-a'),error:null});await oldRead;
  assert.equal(render(sessionB).offers[0].id,'buyer-b');
  currentSession=null;
  assert.deepEqual(render(null).offers,[]);
  render(null,true);await tick();
  assert.deepEqual(render(null).offers,[]);
  if(cleanup)cleanup();
});
