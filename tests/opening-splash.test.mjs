import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithEsbuild } from 'vite';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
async function compile(source, dependencies = {}, globals = {}) {
  const result = await transformWithEsbuild(source,'opening-fixture.tsx',{
    jsx:'transform',jsxFactory:'React.createElement',format:'cjs'
  });
  const module = {exports:{}};
  runInNewContext(result.code,{module,exports:module.exports,React,...globals,require(id){
    if (id.endsWith('.css')) return {};
    if (dependencies[id]) return dependencies[id];
    throw new Error('Unexpected fixture import: '+id);
  }});
  return module.exports;
}
const brand = await compile(read('src/components/BrandLogo.tsx'));
const opening = await compile(read('src/components/OpeningSplash.tsx'),{'./BrandLogo':brand});
const app = read('src/App.tsx');
const headerStart = app.indexOf('<header style=');
const headerEnd = app.indexOf('</header>',headerStart)+'</header>'.length;
assert.ok(headerStart>0 && headerEnd>headerStart);
const header = await compile(`export default function Header(){return (${app.slice(headerStart,headerEnd)});}`,{},{
  BrandLogo:brand.default,favorites:[],changeTab(){},setSelectedCategory(){},
  Plus:()=>React.createElement('svg',{width:16,height:16})
});
const html = renderToStaticMarkup(React.createElement(opening.default));
const headerHtml = renderToStaticMarkup(React.createElement(header.default));
const css = read('src/components/BrandLogo.css')+'\n'+read('src/components/OpeningSplash.css');

test('actual opening and header share accessible wheat branding',()=>{
  assert.match(html,/aria-label="PazarTarla"/);
  assert.match(headerHtml,/pt-wheat-ear/);
  assert.match(html,/pt-splash__curtain--left/);
  assert.match(html,/pt-splash__curtain--right/);
  assert.match(css,/fill:\s*#f2c64e/);
  assert.doesNotMatch(html,/<img|🌾/);
});
test('curtains finish before dismissal and reduced motion disables animation',()=>{
  assert.match(css,/animation-duration:\s*920ms/);
  assert.match(css,/@keyframes pt-curtain-left/);
  assert.match(css,/@keyframes pt-curtain-right/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css,/animation:\s*none/);
  assert.match(app,/setTimeout\(\(\) => setShowSplash\(false\), 1200\)/);
  assert.match(app,/if \(showSplash\) \{\s*return <OpeningSplash \/>;/);
});

// Render actual source components for visual checking; no database calls.
const outputIndex = process.argv.indexOf('--render-output');
if (outputIndex!==-1) {
  const path = process.argv[outputIndex+1];
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,`<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Açılış kontrolü</title><style>${css}
body{margin:0;font-family:system-ui,sans-serif;background:#f4f6f8}
.pt-splash{position:relative;inset:auto;min-height:440px;box-sizing:border-box}
.pt-splash *{animation-play-state:paused!important;animation-delay:-460ms!important}
</style>${headerHtml}${html}<p style="padding:12px;font-size:12px;color:#64748b">Gerçek bileşenlerin animasyon ortasındaki görünümü. Sitede açılış 1,2 saniyede tamamlanır.</p></html>`);
}