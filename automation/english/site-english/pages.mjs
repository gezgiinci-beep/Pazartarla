import {PUBLIC_ORIGIN} from './public-source.mjs';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const translate=(catalog,text)=>typeof text==='string'&&Object.hasOwn(catalog.dictionary,text)?catalog.dictionary[text]:String(text??'');
const active=row=>!row.expires_at||new Date(row.expires_at).getTime()>Date.now();
export const listingPath=row=>`/en/listing/${row.id}`;
export const articlePath=row=>`/en/gazette/haber/${encodeURIComponent(row.slug)}`;
const sourceArticle=row=>`/haber/${encodeURIComponent(row.slug)}`;

export function pageForUrl(url,catalog){
  const path=url.pathname.replace(/\/+$/,'')||'/';
  const t=text=>translate(catalog,text);
  const records=catalog.source;
  const listingMatch=path.match(/^\/en\/(?:listing|ilan)\/(\d+)$/);
  if(listingMatch){
    const row=records.listings.find(row=>String(row.id)===listingMatch[1]&&active(row));
    if(!row)return null;
    return {kind:'listing',path:listingPath(row),title:`${t(row.title)} | PazarTarla`,heading:t(row.title),description:t(row.description).slice(0,160),paragraphs:t(row.description).split(/\n+/),sourcePath:`/ilan/${row.id}`,record:row,entry:'main'};
  }
  const articleMatch=path.match(/^\/en\/(?:gazette\/(?:haber|magazin|rehber)|haber|news)\/(.+)$/);
  if(articleMatch){
    let slug;try{slug=decodeURIComponent(articleMatch[1]);}catch{return null;}
    // Retain the first pilot's bookmarked English slug as an alias.
    if(slug==='denizli-agriculture-director-mustafa-nevzat-zayim')slug='denizli-il-tarim-ve-orman-mudurlugu-ne-mustafa-nevzat-zayim-atandi-67562533';
    const row=records.articles.find(row=>row.slug===slug);
    if(!row)return null;
    return {kind:'article',path:articlePath(row),title:`${t(row.title)} | PazarTarla Gazette`,heading:t(row.title),description:t(row.excerpt),paragraphs:t(row.body).split(/\n+/),sourcePath:sourceArticle(row),record:row,entry:'gazette'};
  }
  if(path==='/en'||path==='/en/gazette'){
    const gazette=path.endsWith('/gazette');
    if(!gazette){
      const information=[
        ['hakkimizda','About PazarTarla','About PazarTarla','PazarTarla connects people trading agricultural land, equipment, crops and livestock. Read listings and confirm commercial details with the advertiser.'],
        ['uzmanlar','Agricultural Experts | PazarTarla','Agricultural experts','Explore agricultural expertise and the PazarTarla expert network. Availability and service areas must be confirmed with the professional.'],
        ['teklifler','Offer Market | PazarTarla','Offer Market','Explore the PazarTarla Offer Market and published store offers. Confirm availability, prices and terms with the relevant business.'],
      ].find(([key])=>url.searchParams.get(key)==='1');
      if(information){
        const [key,title,heading,description]=information;
        return {kind:'information',path:'/en/',canonicalPath:`/en/?${key}=1`,title,heading,description,sourcePath:`/?${key}=1`,paragraphs:[description],entry:'main'};
      }
    }
    const p=Math.max(1,Math.min(1000,Number(url.searchParams.get('page'))||1));
    const list=gazette?records.articles:records.listings.filter(active);
    return {kind:gazette?'gazette':'home',path:gazette?'/en/gazette/':'/en/',title:gazette?'Agricultural News & Guides | PazarTarla Gazette':'Farm Equipment, Land & Agricultural Listings | PazarTarla',
      heading:gazette?'Agricultural news, in English.':'Agriculture connects buyers and sellers.',
      description:gazette?'Read published PazarTarla agricultural news and guides in English. Automatic translations link to their Turkish originals.':'Explore published agricultural listings for land, machinery, livestock and crops. Read the English version and check the Turkish original.',
      sourcePath:gazette?'/pazartarla-gazete/':'/',paragraphs:[],
      cards:list.slice((p-1)*24,p*24).map(row=>({href:gazette?articlePath(row):listingPath(row),title:t(row.title),description:t(gazette?row.excerpt:row.description).slice(0,220)})),
      total:list.length,page:p,pages:Math.ceil(list.length/24),entry:gazette?'gazette':'main'};
  }
  const category=path.match(/^\/en\/gazette\/(haber|magazin|rehber)$/);
  if(category){
    const code=category[1],names={haber:'Agricultural news',magazin:'Agricultural magazine',rehber:'Agricultural guides'};
    return {kind:'gazette',path,title:`${names[code]} | PazarTarla Gazette`,heading:names[code],description:'Published PazarTarla articles, automatically translated into English.',sourcePath:`/pazartarla-gazete/${code}`,paragraphs:[],entry:'gazette',
      cards:records.articles.filter(row=>row.category===code).map(row=>({href:articlePath(row),title:t(row.title),description:t(row.excerpt)}))};
  }
  const tool=path.match(/^\/en\/gazette\/(piyasa(?:\/[a-z0-9_-]+\/[a-z0-9_-]+)?|hava-durumu(?:\/[a-z0-9-]+)?|araclar\/alan-birim-donusturucu)$/);
  if(tool){
    const name=tool[1].startsWith('piyasa')?'Agricultural market prices':tool[1].startsWith('hava-durumu')?'Türkiye weather forecasts':'Land area converter';
    return {kind:'tool',path,title:`${name} | PazarTarla Gazette`,heading:name,description:tool[1].startsWith('piyasa')?'Explore the Gazette market section. Example and reference prices are not live trading quotations; original currencies are preserved.':tool[1].startsWith('hava-durumu')?'Read weather forecasts for Türkiye’s provinces. Forecast source, update time and uncertainty remain visible.':'Convert agricultural land area units without changing original listing measurements.',sourcePath:path.replace('/en/gazette','/pazartarla-gazete'),paragraphs:[],entry:'gazette'};
  }
  if(path==='/en/pazar-analizi'||path==='/en/market-analysis'){
    return {kind:'analysis',path:'/en/pazar-analizi',title:'Agricultural Trade & Market Research | PazarTarla',heading:'Find your next agricultural trading connection.',description:'Explore the PazarTarla trade platform and market-research information. Company references, member requests and examples remain clearly distinguished.',sourcePath:'/pazar-analizi',paragraphs:['Use product, country and market information to discover potential trading connections. Verify availability, capacity and commercial terms with the source. PazarTarla does not guarantee a sale or an export transaction.'],entry:'main'};
  }
  // Existing public Gazette category and reading routes keep their native router.
  if(/^\/en\/gazette\/(?:kategori\/(?:haber|magazin|rehber)|hakkimizda|iletisim)$/.test(path)){
    return {kind:'gazette',path,title:'Agricultural Publication | PazarTarla Gazette',heading:'PazarTarla Gazette',description:'Read PazarTarla agricultural reporting and guides in English.',sourcePath:path.replace('/en/gazette','/pazartarla-gazete'),paragraphs:[],entry:'gazette'};
  }
  return null;
}

export function renderEnglishContent(page,catalog){
  const t=text=>translate(catalog,text);
  const nav='<nav><a href="/en/">Marketplace</a> · <a href="/en/gazette/">Gazette</a> · <a href="/en/pazar-analizi">Trade platform</a> · <a href="/pazar-eslestirme/?lang=en#trade-account">Member account</a></nav>';
  const notice=`<aside role="note">English development preview · automatic translation · not indexed by search engines.<br>New and edited public content is checked automatically every five minutes while the test server is running. New English records appear after processing.<br>Public records checked: ${esc(catalog.lastCheckedAt||catalog.source.checkedAt)}. Prices, availability and terms must be confirmed with the original source.</aside>`;
  const record=page.record;
  const facts=page.kind==='listing'?`<dl><dt>Location</dt><dd>${esc(record.location)}</dd><dt>Source price — no currency conversion</dt><dd>${esc(record.price)}</dd><dt>Category</dt><dd>${esc(t(record.category))} / ${esc(t(record.subCategory))}</dd></dl>`:'';
  const date=record?.published_at||record?.created_at;
  const dates=date?`<p>Original publication date: <time datetime="${esc(date)}">${esc(date)}</time></p>`:'';
  const cards=(page.cards||[]).map(row=>`<article><h2><a href="${esc(row.href)}">${esc(row.title)}</a></h2><p>${esc(row.description)}</p></article>`).join('');
  const pager=page.pages>1?`<nav aria-label="Pagination">${page.page>1?`<a href="${page.path}?page=${page.page-1}">Previous</a>`:''} Page ${page.page} of ${page.pages} ${page.page<page.pages?`<a href="${page.path}?page=${page.page+1}">Next</a>`:''}</nav>`:'';
  return `<style>body{margin:0;background:#f6f7f3;color:#203d2d;font:17px/1.65 system-ui,sans-serif}.english-shell{max-width:1080px;margin:auto;padding:24px}a{color:#1a6441}header{border-bottom:1px solid #cdd9cf;padding-bottom:18px}aside{margin:24px 0;padding:16px;border-left:4px solid #b49c48;background:#f2efdd;font-size:14px}h1{font-size:clamp(30px,5vw,52px);line-height:1.15}h2{font-size:23px}article{border-top:1px solid #d1dcd3;padding:16px 0}dd{margin:0 0 12px}dt{font-weight:700}p,dd{overflow-wrap:anywhere}nav a{display:inline-block;margin:4px}button,input,select{font:inherit}</style>
  <main class="english-shell"><header><strong>PazarTarla</strong>${nav}</header>${notice}<h1>${esc(page.heading)}</h1><p>${esc(page.description)}</p>${dates}${facts}
  ${page.paragraphs.map(text=>`<p>${esc(text)}</p>`).join('')}
  ${record?.author_comment?`<p>${esc(t(record.author_comment))}</p>`:''}
  ${cards}${pager}<p><a href="${esc(PUBLIC_ORIGIN+page.sourcePath)}" hreflang="tr">Read the Turkish original</a></p><p>Automatic translations may contain errors. Do not rely on a translation alone for price, title, legal, auction or delivery terms.</p></main>`;
}
