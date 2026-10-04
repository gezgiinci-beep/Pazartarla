import { useState } from 'react';
import { useStoreMembership } from '../hooks/useStoreMembership';
import './membership.css';

type Props = { state: ReturnType<typeof useStoreMembership>; normalize: (row: any) => any; onListing: (row: any) => void; onBack: () => void };

export default function Storefront({ state, normalize, onListing, onBack }: Props) {
  const store = state.data?.store;
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const rows = state.data?.listings ?? [];
  const retry = () => { void state.refresh(); };
  return <main className="pt-membership pt-storefront">
    <button className="pt-text-button pt-back" type="button" onClick={onBack}>← Mağazalara dön</button>
    {state.loading && !state.data && <div className="pt-member-loading" role="status"><span /> Mağaza bilgileri yükleniyor…</div>}
    {state.error && <div className="pt-member-alert" role="alert"><span>{state.error}</span><button className="pt-button pt-button-secondary" onClick={retry} type="button" disabled={state.loading}>{state.loading ? 'Yenileniyor…' : 'Yeniden dene'}</button></div>}
    {!state.loading && state.data && !store && <section className="pt-member-empty pt-store-notfound"><p className="pt-member-kicker">MAĞAZA BULUNAMADI</p><h1>Bu mağaza şu anda yayında değil.</h1><p>Bağlantı güncel olmayabilir veya mağaza artık herkese açık değildir.</p><button className="pt-button pt-button-primary" type="button" onClick={onBack}>Mağazalara dön</button></section>}
    {store && <>
      <header className="pt-store-hero"><div className="pt-store-seal">{store.name.trim().slice(0, 1).toLocaleUpperCase('tr-TR')}</div><p className="pt-member-kicker">PAZARTARLA ÜRETİCİ MAĞAZASI</p><h1>{store.name}</h1><p>{store.description || 'Bu mağaza için henüz bir tanıtım yazısı eklenmemiş.'}</p><span className="pt-store-count">{rows.length} yayındaki ilan</span></header>
      <section className="pt-member-section"><div className="pt-section-head"><div><p className="pt-member-kicker">MAĞAZADAN</p><h2>Ürün ve hizmetler</h2></div><button type="button" className="pt-button pt-button-secondary" onClick={retry} disabled={state.loading}>{state.loading ? 'Yenileniyor…' : 'Yenile'}</button></div>
        {rows.length ? <div className="pt-listing-grid">{rows.map((raw: any, index: number) => {
          const item = normalize(raw);
          const key = String(item?.id ?? index);
          const candidate = typeof item?.image === 'string' ? item.image : Array.isArray(item?.images) ? item.images[0] : '';
          let src = '';
          try { const parsed = new URL(candidate, window.location.origin); if (['https:', 'http:'].includes(parsed.protocol)) src = parsed.href; } catch { /* render safe image fallback */ }
          return <button type="button" className="pt-listing-card" key={key} onClick={() => onListing(item)}>
            {src && !broken[key] ? <img src={src} alt="" loading="lazy" onError={() => setBroken(current => ({ ...current, [key]: true }))} /> : <span className="pt-listing-image-fallback">PazarTarla</span>}
            <span className="pt-listing-copy"><strong>{item?.title || 'İlan'}</strong><span>{[item?.category, item?.location].filter(Boolean).join(' · ')}</span>{item?.price != null && <b>{new Intl.NumberFormat('tr-TR').format(Number(item.price))} TL</b>}</span>
          </button>;
        })}</div> : state.loading ? <div className="pt-member-loading" role="status"><span /> İlanlar yükleniyor…</div> : <div className="pt-member-empty">Bu mağazada şu anda yayındaki ilan bulunmuyor.</div>}
      </section>
    </>}
  </main>;
}