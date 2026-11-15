const ENGLISH_PREFIX = '/en';
const GAZETTE_PREFIX = '/en/gazette';
const SAFE_PUBLIC_QUERY_KEYS = new Set(['action', 'admin', 'article_id', 'category', 'cursor', 'limit', 'offset', 'page', 'q', 'search', 'slug','resource']);
function englishState() {
  if (typeof window === 'undefined') return null;
  const state = window.__PT_ENGLISH__;
  return state?.locale === 'en' && state.dictionary && typeof state.dictionary === 'object'
    ? state
    : null;
}

export function translateUi(value) {
  if (typeof value !== 'string') return value;
  const dictionary = englishState()?.dictionary;
  if (!dictionary) return value;
  if (!Object.hasOwn(dictionary, value)) return value;
  const translated = dictionary[value];
  return typeof translated === 'string' && translated.length > 0 ? translated : value;
}

export function englishActive() {
  return Boolean(englishState());
}

// Keep the server-rendered English canonical/noindex/JSON-LD. The Turkish
// application's metadata effects remain unchanged on Turkish documents.
export function englishMetadataEffect(effect) {
  return (...args) => englishState() ? undefined : effect(...args);
}

export function englishLocale(originalLocale) {
  if (typeof originalLocale !== 'string') return originalLocale;
  return englishState() && /^tr(?:-TR)?$/i.test(originalLocale) ? 'en-US' : originalLocale;
}

export function englishApiUrl(original) {
  if (!englishState() || typeof original !== 'string') return original;
  try {
    const base = typeof window === 'undefined' ? 'https://pazartarla.invalid' : window.location.origin;
    const url = new URL(original, base);
    const hostname = url.hostname.toLowerCase();
    const ownedOrigin = url.origin === base || hostname === 'pazartarla.com.tr'
      || hostname.endsWith('.pazartarla.com.tr');
    if (!ownedOrigin) return original;
    if(/^\/__pazartarla-preview\/turso\/(?:public-listings|site-settings|offers)$/.test(url.pathname)){
      url.searchParams.set('pt_language','en');
      return `${url.pathname}${url.search}`;
    }
    const match = url.pathname.match(/^\/api\/([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)\/?$/);
    if (!match) return original;
    const safeQuery = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      if (SAFE_PUBLIC_QUERY_KEYS.has(key.toLowerCase()) && value.length <= 256) safeQuery.append(key, value);
    }
    url.pathname = `/_english/public-api/${match[1]}`;
    url.search = safeQuery.toString();
    url.hash = '';
    return `${url.pathname}${url.search}`;
  } catch {
    return original;
  }
}

function protectedPath(pathname) {
  return /(?:^|\/)(?:api|assets?|downloads?|offline-backup|yonetim|admin|security|guvenlik|auth\/callback|callback)(?:\/|$)/i.test(pathname)
    || /(?:^|\/)__/.test(pathname);
}

function toPath(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const base = typeof window === 'undefined' ? 'https://pazartarla.invalid' : window.location.origin;
    const url = new URL(value, base);
    if (url.origin !== base && typeof window !== 'undefined') return null;
    return url;
  } catch {
    return null;
  }
}

function localizedUrl(value, scope) {
  if (!englishState()) return value;
  const url = toPath(value);
  if (!url || protectedPath(url.pathname) || url.hash) return value;
  const path = url.pathname;
  if (path === '/en' || path.startsWith('/en/')) return value;

  let localized = null;
  if (scope === 'marketplace' && /(?:^|\/)pazar-eslestirme\/?$/i.test(path)) {
    url.pathname = '/pazar-eslestirme/';
    url.searchParams.set('lang', 'en');
    return `${url.pathname}${url.search}`;
  }
  const absoluteUrl = /^[a-z][a-z\d+.-]*:\/\//i.test(value);
  if (scope === 'gazette' && !absoluteUrl) {
    const sourcePath = path.replace(/^\/pazartarla-gazete(?=\/|$)/, '') || '/';
    if (protectedPath(sourcePath)) return value;
    if (sourcePath === '/' || sourcePath === '') localized = `${GAZETTE_PREFIX}/`;
    else if (/^\/haber\/[a-zA-Z0-9-]{1,160}\/?$/.test(sourcePath)) localized = `${GAZETTE_PREFIX}${sourcePath}`;
    else if (sourcePath.startsWith('/')) localized = `${GAZETTE_PREFIX}${sourcePath}`;
  } else if (scope === 'marketplace' || scope === 'gazette') {
    if (path === '/' || path === '') localized = `${ENGLISH_PREFIX}/`;
    else {
      const listing = path.match(/^\/ilan\/([a-zA-Z0-9_-]{1,160})\/?$/);
      if (listing) localized = `${ENGLISH_PREFIX}/listing/${listing[1]}`;
      else if (path === '/pazartarla-gazete' || path.startsWith('/pazartarla-gazete/')) {
        localized = `${GAZETTE_PREFIX}${path.slice('/pazartarla-gazete'.length) || '/'}`;
      }
    }
  }
  if (!localized) return value;
  url.pathname = localized;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function englishHref(value, scope) {
  return localizedUrl(value, scope);
}

export function englishClick(existingHandler) {
  return (event) => {
    if (typeof existingHandler === 'function') existingHandler(event);
    if (!englishState() || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.currentTarget;
    if (!anchor || anchor.target && anchor.target !== '_self' || anchor.hasAttribute?.('download')) return;
    const href = anchor.href;
    const url = toPath(href);
    if (!url || protectedPath(url.pathname) || !(url.pathname === '/en' || url.pathname.startsWith('/en/'))) return;
    event.preventDefault();
    window.location.assign(url.href);
  };
}

export function englishSourceUrl(value) {
  if (!englishState() || typeof value !== 'string') return value;
  const url = toPath(value);
  if (!url) return value;
  if (url.pathname === '/en/' || url.pathname === '/en') url.pathname = '/';
  const listing = url.pathname.match(/^\/en\/listing\/([a-zA-Z0-9_-]{1,160})\/?$/);
  if (listing) url.pathname = `/ilan/${listing[1]}`;
  return url.href;
}

export function englishGazetteBase(originalBase) {
  return englishState() ? GAZETTE_PREFIX : originalBase;
}

// A long-lived English tab must load new translations before consuming new
// public records. Neither request bodies nor the original response data change.
export function installEnglishFetch({loadDictionary=async version=>
  import(/* @vite-ignore */ `/_english/catalog/${version}.js`)}={}) {
  if(!englishState()||window.__PT_ENGLISH_FETCH_INSTALLED__)return;
  window.__PT_ENGLISH_FETCH_INSTALLED__=true;
  const nativeFetch=window.fetch.bind(window),loads=new Map();
  const mainPaths=new Set(['/__pazartarla-preview/turso/public-listings',
    '/__pazartarla-preview/turso/site-settings','/__pazartarla-preview/turso/offers']);
  window.fetch=async(input,init)=>{
    let url;try{url=new URL(typeof input==='string'?input:input?.url||input?.href,window.location.origin);}catch{}
    const state=englishState();
    const method=String(init?.method||input?.method||'GET').toUpperCase();
    const controlled=state&&method==='GET'&&!init?.body&&url?.origin===window.location.origin
      &&(mainPaths.has(url.pathname)||url.pathname==='/api/site-settings'||url.pathname.startsWith('/_english/public-api/'));
    let request=input;
    if(controlled&&(mainPaths.has(url.pathname)||url.pathname==='/api/site-settings')){
      const path=englishApiUrl(url.pathname+url.search);
      request=typeof Request!=='undefined'&&input instanceof Request
        ?new Request(new URL(path,window.location.origin),input):path;
    }
    const response=await nativeFetch(request,init);
    if(!controlled||!response.ok)return response;
    const version=response.headers.get('X-PT-English-Catalog');
    if(!version)return response;
    if(!/^[a-f0-9]{8,64}$/.test(version))throw new Error('Invalid English translation edition.');
    const checkedAt=response.headers.get('X-PT-English-Checked-At');
    const timestamp=Date.parse(checkedAt)||0;
    const outdated=()=>version!==state.catalogVersion&&timestamp<(Date.parse(state.catalogCheckedAt)||0);
    if(outdated())throw new Error('An older English response was ignored. Please retry.');
    if(version!==state.catalogVersion){
      let pending=loads.get(version);
      if(!pending){
        pending=Promise.resolve().then(()=>loadDictionary(version)).finally(()=>loads.delete(version));
        loads.set(version,pending);
      }
      const module=await pending;
      if(outdated())throw new Error('An older English response was ignored. Please retry.');
      if(!module?.default||typeof module.default!=='object'
        ||Object.values(module.default).some(value=>typeof value!=='string'))
        throw new Error('The English translation update is not ready.');
      // Keep already-read texts in this tab so an older open article does not
      // revert to Turkish. Obsolete texts are still removed from server files.
      state.dictionary=Object.assign(Object.create(null),state.dictionary,module.default);
      state.catalogVersion=version;
    }
    if(timestamp>=(Date.parse(state.catalogCheckedAt)||0))state.catalogCheckedAt=checkedAt;
    return response;
  };
}
