import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_LISTINGS, DEMO_NOTICE, DEMO_STORES } from '../lib/demoMarketplace';
import type { DemoListing } from '../lib/demoMarketplace';
import './demo-marketplace.css';

type Props = { variant?: 'catalog' | 'stores' };
type Sel = { store: string; listing: string };

const fmt = new Intl.NumberFormat('tr-TR');
const price = (l: DemoListing) => `${fmt.format(l.price)} TL / ${l.unit} (örnek)`;

function readUrl(): Sel {
  const p = new URLSearchParams(window.location.search);
  const listing = DEMO_LISTINGS.find(l => l.id === p.get('demo_ilan'));
  const store = DEMO_STORES.find(s => s.id === p.get('demo_magaza'));
  if (listing) return { store: listing.storeId, listing: listing.id };
  return { store: store?.id ?? '', listing: '' };
}

function writeUrl(sel: Sel, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  url.searchParams.delete('demo_magaza');
  url.searchParams.delete('demo_ilan');
  if (sel.store) url.searchParams.set('demo_magaza', sel.store);
  if (sel.listing) url.searchParams.set('demo_ilan', sel.listing);
  const next = url.pathname + url.search + url.hash;
  if (next === window.location.pathname + window.location.search + window.location.hash) return;
  const state = window.history.state;
  if (mode === 'push') window.history.pushState(state, '', next);
  else window.history.replaceState(state, '', next);
}

const Badge = ({ id }: { id: string }) => <span className="pt-demo-badge" data-testid={`demo-badge-${id}`}>Demo / Örnek</span>;

export default function DemoMarketplace({ variant = 'catalog' }: Props) {
  const [sel, setSel] = useState<Sel>(() => readUrl());
  const [cat, setCat] = useState('Tümü');
  const focusRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(!!sel.store || !!sel.listing);

  useEffect(() => {
    const onPop = () => setSel(readUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (moved.current) focusRef.current?.focus();
  }, [sel.store, sel.listing]);

  const go = useCallback((next: Sel) => {
    moved.current = true;
    writeUrl(next, 'push');
    setSel(next);
  }, []);

  const store = DEMO_STORES.find(s => s.id === sel.store);
  const listing = DEMO_LISTINGS.find(l => l.id === sel.listing);
  const cats = ['Tümü', ...Array.from(new Set(DEMO_LISTINGS.map(l => l.category)))];
  const showAll = variant === 'catalog' && !store;
  const pool = store ? DEMO_LISTINGS.filter(l => l.storeId === store.id) : variant === 'catalog' ? DEMO_LISTINGS : [];
  const rows = showAll ? pool.filter(l => cat === 'Tümü' || l.category === cat) : pool;

  const card = (l: DemoListing) => (
    <button key={l.id} type="button" className="pt-demo-listing" data-testid={`demo-listing-${l.id}`}
      onClick={() => go({ store: l.storeId, listing: l.id })}>
      <img src={l.image} alt="" loading="lazy" decoding="async" />
      <span className="pt-demo-listing-copy">
        <Badge id={l.id} />
        <strong>{l.title}</strong>
        <span>{l.category} · {l.location}</span>
        <b>{price(l)}</b>
      </span>
    </button>
  );

  return (
    <section className="pt-demo-root" data-testid="demo-marketplace" aria-label="Demo / Örnek mağazalar">
      <p className="pt-demo-notice" role="note" data-testid="demo-notice">{DEMO_NOTICE}</p>

      {listing ? (
        <article className="pt-demo-detail" data-testid="demo-listing-detail">
          <button type="button" className="pt-demo-back" onClick={() => go({ store: listing.storeId, listing: '' })}>← Geri dön</button>
          <Badge id={`detail-${listing.id}`} />
          <h3 tabIndex={-1} ref={focusRef}>{listing.title}</h3>
          <img src={listing.image} alt="Temsili örnek fotoğraf" loading="lazy" decoding="async" />
          <div className="pt-demo-price">{price(listing)}</div>
          <p>{listing.category} · {listing.location} · {DEMO_STORES.find(s => s.id === listing.storeId)?.name}</p>
          <p>{listing.description}</p>
          <p>Görsel temsilidir. Bu örnek ilan üzerinden satış, teklif veya iletişim yapılamaz.</p>
        </article>
      ) : (
        <>
          {store ? (
            <div className="pt-demo-detail" data-testid="demo-store-detail">
              <button type="button" className="pt-demo-back" onClick={() => go({ store: '', listing: '' })}>← Mağazalara dön</button>
              <Badge id={`detail-${store.id}`} />
              <h3 tabIndex={-1} ref={focusRef}>{store.name}</h3>
              <p>{store.category} · {store.location}</p>
              <p>{store.description}</p>
            </div>
          ) : (
            <>
              <div className="pt-demo-head">
                <p className="pt-demo-kicker">DEMO / ÖRNEK</p>
                <h2 className="pt-demo-title">Örnek mağazalar</h2>
              </div>
              <div className="pt-demo-stores">
                {DEMO_STORES.map(s => (
                  <button key={s.id} type="button" className="pt-demo-store" data-testid={`demo-store-${s.id}`}
                    onClick={() => go({ store: s.id, listing: '' })}>
                    <img src={s.image} alt="" loading="lazy" decoding="async" />
                    <span className="pt-demo-store-copy">
                      <Badge id={s.id} />
                      <strong>{s.name}</strong>
                      <small>{s.category} · {s.location}</small>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {showAll && (
            <div className="pt-demo-filters" role="group" aria-label="Kategori filtresi">
              {cats.map(c => (
                <button key={c} type="button" className="pt-demo-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          )}

          {rows.length > 0 ? (
            <div className="pt-demo-grid">{rows.map(card)}</div>
          ) : variant === 'catalog' || store ? (
            <div className="pt-demo-empty">Bu kategoride örnek ilan yok.</div>
          ) : null}
        </>
      )}
    </section>
  );
}
