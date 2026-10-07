import { useMemo, useState } from 'react';
import type { Offer, OffersState } from '../hooks/useOffers';
import OfferExamples from './OfferExamples';
import './offers.css';

type Props = {
  state: OffersState; listings: any[]; ownListings: any[]; session: any | null;
  onOpenListing: (item: any) => void; onSignIn: () => void; onCreateListing: () => void; onBack: () => void;
};

const STATUS: Record<Offer['status'], string> = { pending: 'Yanıt bekliyor', countered: 'Karşı teklif', accepted: 'Kabul edildi', declined: 'Reddedildi' };
const tl = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n) + ' TL';
const when = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(d); };
const digits = (p: string) => { let d = p.replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('0')) d = '90' + d.slice(1); else if (d.length === 10) d = '90' + d; return d; };

function OfferCard({ offer, state }: { offer: Offer; state: OffersState }) {
  const [counter, setCounter] = useState('');
  const [body, setBody] = useState('');
  const locked = state.busy || !!state.error;
  const seller = offer.role === 'seller';
  const msgs = state.messages.filter(m => m.offer_id === offer.id);
  const both = !!offer.buyer_phone && !!offer.seller_phone;
  const other = seller ? offer.buyer_phone : offer.seller_phone;
  const c = Number(counter.replace(',', '.'));
  const run = (a: Parameters<OffersState['respond']>[1], amt?: number) => { void state.respond(offer.id, a, amt); };
  const id = offer.id;
  return (
    <article className="pt-o-offer" data-testid={`card-offer-${id}`}>
      <header>
        <div><h3>{offer.title}</h3><p className="pt-o-note">{seller ? 'Size gelen teklif' : 'Verdiğiniz teklif'} · {when(offer.created_at)}</p></div>
        <span className={`pt-o-badge ${offer.status}`} data-testid={`status-offer-${id}`}>{STATUS[offer.status]}</span>
      </header>
      <div className="pt-o-meta">
        <span>Teklif: <b>{tl(offer.amount)}</b></span>
        {offer.counter_amount != null && <span>Karşı teklif: <b>{tl(offer.counter_amount)}</b></span>}
        <span>Miktar: <b>{offer.quantity}</b></span>
      </div>
      {offer.note && <p className="pt-o-note">Not: {offer.note}</p>}

      {offer.status === 'pending' && seller && (
        <div className="pt-o-row">
          <button type="button" className="pt-o-btn dark" disabled={locked} onClick={() => run('accept')} data-testid={`button-offer-accept-${id}`}>Kabul et</button>
          <button type="button" className="pt-o-btn danger" disabled={locked} onClick={() => run('decline')} data-testid={`button-offer-decline-${id}`}>Reddet</button>
          <label className="pt-o-field" style={{ flex: '1 1 150px' }}>Karşı teklif (TL)
            <input inputMode="decimal" value={counter} onChange={e => setCounter(e.target.value)} data-testid={`input-offer-counter-${id}`} />
          </label>
          <button type="button" className="pt-o-btn" disabled={locked || !Number.isFinite(c) || c<0.01 || c>9999999999 || c===offer.amount} onClick={() => run('counter', c)} data-testid={`button-offer-counter-${id}`}>Karşı teklif gönder</button>
        </div>
      )}
      {offer.status === 'pending' && !seller && <p className="pt-o-note">Satıcının yanıtı bekleniyor.</p>}
      {offer.status === 'countered' && !seller && (
        <div className="pt-o-row">
          <button type="button" className="pt-o-btn dark" disabled={locked} onClick={() => run('buyer_accept')} data-testid={`button-offer-buyer-accept-${id}`}>Karşı teklifi kabul et</button>
          <button type="button" className="pt-o-btn danger" disabled={locked} onClick={() => run('buyer_decline')} data-testid={`button-offer-buyer-decline-${id}`}>Reddet</button>
        </div>
      )}
      {offer.status === 'countered' && seller && <p className="pt-o-note">Alıcının yanıtı bekleniyor.</p>}

      {offer.status === 'accepted' && (
        <>
          <p className="pt-o-note">Anlaşma sağlandı. Teslimat ve ödemeyi taraflar kendi aralarında belirler; bu sitede ödeme alınmaz.</p>
          {both && other && (
            <div className="pt-o-row">
              <a className="pt-o-btn" href={`tel:${other.replace(/[^\d+]/g, '')}`} data-testid={`link-offer-tel-${id}`}>Ara: {other}</a>
              <a className="pt-o-btn" href={`https://wa.me/${digits(other)}`} target="_blank" rel="noopener noreferrer" data-testid={`link-offer-whatsapp-${id}`}>WhatsApp</a>
            </div>
          )}
          <div className="pt-o-msgs" role="log" aria-label="Mesajlar" data-testid={`list-offer-messages-${id}`}>
            {msgs.length === 0 && <span className="pt-o-note">Henüz mesaj yok.</span>}
            {msgs.map(m => (
              <div key={m.id} className={`pt-o-msg${m.actor === offer.role ? ' mine' : ''}`}>{m.body}<time>{when(m.created_at)}</time></div>
            ))}
          </div>
          <form className="pt-o-row" onSubmit={async e => { e.preventDefault(); if (!body.trim() || locked) return; if (await state.sendMessage(id, body.trim())) setBody(''); }}>
            <label className="pt-o-field" style={{ flex: '1 1 200px' }}>Mesajınız
              <input value={body} maxLength={1000} onChange={e => setBody(e.target.value)} data-testid={`input-offer-message-${id}`} />
            </label>
            <button type="submit" className="pt-o-btn dark" disabled={locked || !body.trim()} data-testid={`button-offer-message-${id}`}>Gönder</button>
          </form>
        </>
      )}
    </article>
  );
}

export default function OfferMarketplace({ state, listings, ownListings, session, onOpenListing, onSignIn, onCreateListing, onBack }: Props) {
  const [tab, setTab] = useState<'catalog' | 'mine'>('catalog');
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const catalog = useMemo(() => listings.filter(l => state.catalogIds.includes(Number(l.id))), [listings, state.catalogIds]);
  const ownOn = ownListings.filter(l => state.settings[Number(l.id)]).length;
  const sellerOffers = state.offers.filter(o => o.role === 'seller');
  const buyerOffers = state.offers.filter(o => o.role === 'buyer');

  return (
    <section className="pt-offers" data-testid="page-offers">
      <button type="button" className="pt-o-btn" onClick={onBack} data-testid="button-offers-back">Ana sayfaya dön</button>
      <section className="pt-offers-hero">
        <p className="pt-offers-kicker">PAZARLIK MASASI</p>
        <h1>Üreticiyle yüz yüze konuşur gibi pazarlık edin.</h1>
        <p>Satıcının teklife açtığı ilanlarda fiyatı özel olarak görüşün. Teklifleri yalnızca satıcı ve teklifi veren alıcı görür.</p>
        <div className="pt-offers-actions">
          <button type="button" className="pt-o-btn primary" disabled={state.busy||state.loading||!!state.error} onClick={() => session ? onCreateListing() : onSignIn()} data-testid="button-offers-create-listing">Teklife açık ilan ver</button>
          <button type="button" className="pt-o-btn" onClick={() => void state.refresh()} disabled={state.loading} data-testid="button-offers-refresh">{state.loading ? 'Yenileniyor…' : 'Yenile'}</button>
        </div>
      </section>

      <div className="pt-o-tabs" role="tablist" aria-label="Teklif alanı">
        <button type="button" role="tab" id="tab-offers-catalog" aria-selected={tab === 'catalog'} aria-controls="panel-offers-catalog" className="pt-o-tab" onClick={() => setTab('catalog')} data-testid="tab-offers-catalog">Teklife açık ilanlar</button>
        <button type="button" role="tab" id="tab-offers-mine" aria-selected={tab === 'mine'} aria-controls="panel-offers-mine" className="pt-o-tab" onClick={() => setTab('mine')} data-testid="tab-offers-mine">Tekliflerim</button>
      </div>

      {state.error && <div className="pt-o-alert" role="alert" data-testid="status-offers-error">{state.error}</div>}
      {state.actionError && !state.error && <div className="pt-o-alert" role="alert" data-testid="status-offers-action-error">{state.actionError}</div>}

      {tab === 'catalog' && (
        <section id="panel-offers-catalog" role="tabpanel" aria-labelledby="tab-offers-catalog">
          {state.loading ? (
            <div className="pt-o-grid" role="status" aria-label="Yükleniyor">{[0, 1, 2, 3].map(i => <div key={i} className="pt-o-skel" />)}</div>
          ) : state.error ? null : catalog.length === 0 ? (
            <div className="pt-o-empty" data-testid="status-offers-catalog-empty">Şu anda teklife açık gerçek onaylı ilan yok. Satıcılar ilan detayından teklif almayı açtığında burada görünür.</div>
          ) : (
            <div className="pt-o-grid">
              {catalog.map((item, i) => {
                const key = String(item.id ?? i);
                const src = typeof item.image === 'string' ? item.image : '';
                return (
                  <button type="button" key={key} className="pt-o-card" onClick={() => onOpenListing(item)} data-testid={`card-offer-listing-${key}`}>
                    {src && !broken[key] ? <img src={src} alt="" loading="lazy" onError={() => setBroken(b => ({ ...b, [key]: true }))} /> : <span className="ph" />}
                    <span className="body">
                      <span className="pt-o-badge">Teklife açık</span>
                      <strong>{item.title || 'İlan'}</strong>
                      <span>{[item.category, item.location].filter(Boolean).join(' · ')}</span>
                      {item.price != null && <b>{tl(Number(item.price))}</b>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <OfferExamples />
        </section>
      )}

      {tab === 'mine' && (
        <section id="panel-offers-mine" role="tabpanel" aria-labelledby="tab-offers-mine" className="pt-o-list">
          {!session ? (
            <div className="pt-o-empty" data-testid="status-offers-signed-out">Tekliflerinizi görmek için giriş yapın.<br /><button type="button" className="pt-o-btn dark" style={{ marginTop: 12 }} onClick={onSignIn} data-testid="button-offers-signin">Giriş yap</button></div>
          ) : state.loading ? (
            <div role="status" aria-label="Yükleniyor"><div className="pt-o-skel" /></div>
          ) : state.error ? null : (
            <>
              {ownListings.length > 0 && <p className="pt-o-note" data-testid="text-offers-own-count">{ownListings.length} ilanınızdan {ownOn} tanesi teklife açık. Her ilanı kendi detay sayfasından ayrı ayrı açıp kapatırsınız.</p>}
              <p className="pt-o-note">Son 100 görüşme ve son 500 mesaj gösterilir. Teklif almayı kapatmak yeni teklifleri durdurur; mevcut görüşmeleriniz korunur.</p>
              <h2 style={{ fontSize: 17, color: '#244735' }}>Gelen teklifler</h2>
              {sellerOffers.length === 0 ? <div className="pt-o-empty" data-testid="status-offers-seller-empty">Henüz size gelen teklif yok.</div> : sellerOffers.map(o => <OfferCard key={o.id} offer={o} state={state} />)}
              <h2 style={{ fontSize: 17, color: '#244735', marginTop: 8 }}>Verdiğim teklifler</h2>
              {buyerOffers.length === 0 ? <div className="pt-o-empty" data-testid="status-offers-buyer-empty">Henüz teklif vermediniz. Teklife açık ilanlardan birini seçin.</div> : buyerOffers.map(o => <OfferCard key={o.id} offer={o} state={state} />)}
            </>
          )}
        </section>
      )}
    </section>
  );
}
