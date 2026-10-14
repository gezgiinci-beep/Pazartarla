import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url);
const {buildSync}=createRequire(require.resolve('vite/package.json'))('esbuild');
const componentUrl=new URL('../src/components/PlatformIntroduction.tsx',import.meta.url);
const code=buildSync({entryPoints:[fileURLToPath(componentUrl)],bundle:true,write:false,
  platform:'node',format:'cjs',packages:'external',jsx:'automatic',loader:{'.css':'empty'}}).outputFiles[0].text;
const module={exports:{}};
new Function('require','module','exports',code)(require,module,module.exports);
const html=renderToStaticMarkup(React.createElement(module.exports.default));
const normalize=text=>text.replace(/\s+/g,' ').trim();
const text=normalize(html.replace(/<[^>]*>/g,'').replace(/&#x27;|&#39;/g,"'")
  .replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));

test('The entire user-supplied introduction is preserved, including all benefits and price text',()=>{
  const original=readFileSync(new URL('./fixtures/platform-introduction.txt',import.meta.url),'utf8');
  for(const paragraph of original.split(/\r?\n/).map(normalize).filter(Boolean))
    assert(text.includes(paragraph),'Missing or altered text: '+paragraph.slice(0,85));
});
test('Introduction is native, collapsed and keyboard accessible by default',()=>{
  const details=html.match(/<details\b[^>]*>/)?.[0];
  assert(details);
  assert(!/\bopen(?:=|\s|>)/.test(details));
  assert.match(html,/<summary\b[^>]*data-testid="platform-introduction-toggle"/);
  assert.match(html,/data-testid="platform-introduction"/);
});
test('Introduction is home-only, outside the listing main and contains no data-changing behavior',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const mainEnd=app.indexOf('</main>');
  const introduction=app.indexOf("{activeTab === 'home' && <PlatformIntroduction />}");
  const footer=app.indexOf('<footer',introduction);
  assert(mainEnd>=0&&introduction>mainEnd&&footer>introduction);
  const component=readFileSync(componentUrl,'utf8');
  assert(!/\b(fetch|localStorage|sessionStorage|supabase|useEffect|useState)\b|\.rpc\s*\(/.test(component));
});
