import {parse,parseFragment,serialize} from 'parse5';
import {renderEnglishContent,esc,listingPath,articlePath} from '../pages.mjs';
import {PUBLIC_ORIGIN,sourceHash} from '../public-source.mjs';

const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const find=(node,test)=>test(node)?node:(node.childNodes||[]).map(child=>find(child,test)).find(Boolean);
function remove(node,test){
  node.childNodes=(node.childNodes||[]).filter(child=>!test(child));
  for(const child of node.childNodes)remove(child,test);
}
function append(node,html){
  const children=parseFragment(html).childNodes;
  for(const child of children)child.parentNode=node;
  node.childNodes.push(...children);
}
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export function liveEnglishDocument(template,page,catalog,{indexable=false}={}){
  const doc=parse(template),head=find(doc,node=>node.tagName==='head'),body=find(doc,node=>node.tagName==='body');
  const root=find(doc,node=>attr(node,'id')==='root'),html=find(doc,node=>node.tagName==='html');
  const entries=[];
  remove(doc,node=>{
    if(node.tagName==='script'&&attr(node,'type')==='module'&&attr(node,'src')){
      entries.push(attr(node,'src'));return true;
    }
    return false;
  });
  if(!head||!body||!root||entries.length!==1||!entries[0].startsWith('/')||entries[0].startsWith('//'))
    throw new Error('INVALID_ENGLISH_BUILD_TEMPLATE');
  html.attrs=html.attrs.filter(item=>item.name!=='lang');html.attrs.push({name:'lang',value:'en'});
  remove(head,node=>node.tagName==='title'||node.tagName==='meta'&&(
    ['description','robots'].includes(attr(node,'name'))||(attr(node,'property')||'').startsWith('og:')
    ||(attr(node,'name')||'').startsWith('twitter:'))
    ||node.tagName==='link'&&['canonical','alternate'].includes(attr(node,'rel'))
    ||node.tagName==='script'&&attr(node,'type')==='application/ld+json');
  const canonical=PUBLIC_ORIGIN+(page.canonicalPath||page.path),original=PUBLIC_ORIGIN+page.sourcePath;
  const image=page.record?.image||page.record?.media?.find(item=>item.url)?.url;
  const graph={'@context':'https://schema.org','@type':page.kind==='article'?'NewsArticle':'WebPage',
    name:page.heading,description:page.description,url:canonical,inLanguage:'en',isBasedOn:original,
    ...(page.kind==='article'?{headline:page.heading,datePublished:page.record.published_at,
      dateModified:page.record.updated_at,author:{'@type':'Organization',name:'PazarTarla Gazette'}}:{})};
  append(head,`<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${indexable?'index,follow':'noindex,nofollow,noarchive'}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="en" href="${esc(canonical)}">
<link rel="alternate" hreflang="tr" href="${esc(original)}">
<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:locale" content="en_GB">
<meta property="og:locale:alternate" content="tr_TR">
<meta property="og:type" content="${page.kind==='article'?'article':'website'}">
${image?`<meta property="og:image" content="${esc(image)}">`:''}
<meta name="twitter:card" content="${image?'summary_large_image':'summary'}">
<script type="application/ld+json">${json(graph)}</script>`);
  root.childNodes=[];append(root,renderEnglishContent(page,catalog));
  // Inert catalogue JSON is data, not executable code. It is one atomically
  // validated edition with the SSR body, so the app cannot hydrate an old copy.
  const bootstrap={locale:'en',metadata:{title:page.title,description:page.description},
    publicSourcePreview:false,catalogVersion:sourceHash(catalog.dictionary),
    catalogCheckedAt:catalog.lastCheckedAt||catalog.source.checkedAt,dictionary:catalog.dictionary};
  append(body,`<aside id="pt-en-notice" style="padding:9px 16px;background:#f3edcf;color:#3c4937;font:13px/1.5 system-ui">
Automatic English translation. Verify commercial and legal details against the
<a href="${esc(original)}" lang="tr">Turkish original</a>.
Edition: ${esc(catalog.source.checkedAt)}.
<a href="/?lang=tr" lang="tr">Türkçe</a> · <a href="/en/">English</a></aside>
<script id="pt-english-edition" type="application/json">${json(bootstrap)}</script>
<script type="module">window.__PT_ENGLISH__=JSON.parse(document.getElementById('pt-english-edition').textContent);
const {installEnglishFetch}=await import('/_english/runtime.js');installEnglishFetch();
await import(${json(entries[0])});</script>`);
  const notice=find(body,node=>attr(node,'id')==='pt-en-notice');
  body.childNodes=body.childNodes.filter(child=>child!==notice);body.childNodes.unshift(notice);
  return serialize(doc);
}
export function englishSitemap(catalog){
  const pages=[
    {en:'/en/',tr:'/'},{en:'/en/gazette/',tr:'/pazartarla-gazete/'},
    {en:'/en/pazar-analizi',tr:'/pazar-analizi'},
    ...catalog.source.listings.map(row=>({en:listingPath(row),tr:`/ilan/${row.id}`})),
    ...catalog.source.articles.map(row=>({en:articlePath(row),tr:`/pazartarla-gazete/haber/${row.slug}`})),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${
    pages.map(page=>`<url><loc>${esc(PUBLIC_ORIGIN+page.en)}</loc>
<xhtml:link rel="alternate" hreflang="en" href="${esc(PUBLIC_ORIGIN+page.en)}"/>
<xhtml:link rel="alternate" hreflang="tr" href="${esc(PUBLIC_ORIGIN+page.tr)}"/></url>`).join('')
  }</urlset>`;
}
