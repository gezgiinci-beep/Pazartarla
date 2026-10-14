import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {build}=createRequire(require.resolve('vite/package.json'))('esbuild');
const module=await build({entryPoints:[fileURLToPath(new URL('../src/components/DemoMarketplace.tsx',import.meta.url))],
  bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',
  plugins:[{name:'ssr-assets',setup(b){b.onResolve({filter:/\.(css|webp)$/},a=>({path:a.path,namespace:'ssr-assets'}));
    b.onLoad({filter:/.*/,namespace:'ssr-assets'},a=>({contents:a.path.endsWith('.css')?'':"export default 'demo-photo.webp';",loader:'js'}));}}]});
const exports={exports:{}};new Function('require','module','exports',module.outputFiles[0].text)(require,exports,exports.exports);
const Demo=exports.exports.default;
const render=(params='',variant='catalog')=>{
  const u=new URL('https://example.invalid/?'+params);
  global.window={location:{href:u.href,search:u.search,pathname:u.pathname,hash:''}};
  return renderToStaticMarkup(React.createElement(Demo,{variant}));
};
const count=(html,expression)=>(html.match(expression)||[]).length;
test('Üç açıkça etiketli örnek mağaza ve toplam 18 örnek ilan vardır',()=>{
  const html=render();
  assert.equal(count(html,/data-testid="demo-store-demo-/g),3);
  assert.equal(count(html,/data-testid="demo-listing-demo-product-/g),18);
  assert.equal(count(html,/class="pt-demo-badge"/g),21);
  assert.match(html,/gerçek satış kayıtları değildir/);
  assert.match(html,/fiyat|Fiyat/);
  assert(!html.includes('href="tel:'));assert(!html.includes('wa.me'));
});
test('Her örnek mağazanın altı ürünü ve kendi örnek etiketi vardır',()=>{
  for(const id of ['demo-bereket','demo-bahce','demo-ekipman']){
    const html=render('demo_magaza='+id);
    assert.equal(count(html,/data-testid="demo-listing-demo-product-/g),6);
    assert.match(html,/data-testid="demo-store-detail"/);
    assert.equal(count(html,/class="pt-demo-badge"/g),7);
  }
});
test('Mağaza menüsü üç mağaza gösterir ve gerçek olmayan ürünleri veri katmanına taşımaz',()=>{
  const html=render('','stores');
  assert.equal(count(html,/data-testid="demo-store-demo-/g),3);
  assert.equal(count(html,/data-testid="demo-listing-demo-product-/g),0);
});
test('Doğrudan ürün bağlantısı ve yenileme örnek ürün ayrıntısını açar',()=>{
  const html=render('demo_ilan=demo-product-1&demo_magaza=demo-bahce');
  assert.match(html,/data-testid="demo-listing-detail"/);
  assert.match(html,/Ekmeklik buğday/);assert.match(html,/Bereket Tahıl/);
  assert.match(html,/Demo \/ Örnek/);assert.match(html,/satış, teklif veya iletişim yapılamaz/);
  assert.equal(count(html,/data-testid="demo-listing-demo-product-/g),0);
});
test('Bilinmeyen örnek kimlikleri güvenle başlangıç görünümüne döner',()=>{
  assert.equal(count(render('demo_ilan=1&demo_magaza=unknown'),/data-testid="demo-listing-demo-product-/g),18);
});
test('Örnek bileşenlerinde ağ, hesap, teklif veya veritabanı işlemi yoktur',()=>{
  for(const path of ['../src/components/DemoMarketplace.tsx','../src/lib/demoMarketplace.ts']){
    const source=readFileSync(new URL(path,import.meta.url),'utf8');
    assert(!/\bfetch\s*\(|\.rpc\s*\(|supabase|\/rest\/v1|localStorage|sessionStorage|tel:|wa\.me/.test(source));
  }
  const source=readFileSync(new URL('../src/components/DemoMarketplace.tsx',import.meta.url),'utf8');
  assert.match(source,/const state = window\.history\.state/);
  assert.match(source,/pushState\(state/);assert.match(source,/'popstate'/);
});
