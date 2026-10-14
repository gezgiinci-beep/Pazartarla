import { useState } from 'react';
import type { OffersState } from '../hooks/useOffers';
import './offers.css';

type Props = { listing: any; state: OffersState; session: any | null; onSignIn: () => void; onViewOffers: () => void };

export default function OfferListingControls({ listing, state, session, onSignIn, onViewOffers }: Props) {
  const id = Number(listing?.id);
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const isOwner = state.ownerIds.includes(id);
  const enabled = !!state.settings[id];
  const inCatalog = state.catalogIds.includes(id);
  const locked = state.busy || !!state.error;
  const amt = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(amt) && amt > 0 && amt<=9999999999 && quantity.trim().length > 0 &&
    /^[+]?[0-9 ()-]{10,24}$/.test(phone.trim()) && phone.replace(/\D/g,'').length>=10 &&
    phone.replace(/\D/g,'').length<=15;
  const openOffer = state.offers.find(offer=>offer.listing_id===id&&offer.role==='buyer'&&['pending','countered'].includes(offer.status));

  if (state.loading && !state.error) return <section className="pt-offer-controls" role="status" aria-busy="true"><div className="pt-o-skel" style={{ height: 56 }} /></section>;

  if (isOwner) {
    return (
      <section className="pt-offer-controls pt-offers" style={{ background: '#fffef9', padding: 16 }} aria-labelledby={`oc-t-${id}`} data-testid={`panel-offer-owner-${id}`}>
        <h3 id={`oc-t-${id}`}>Özel teklif ayarı</h3>
        <p className="pt-o-note">Açtığınızda bu ilan için alıcılar size özel teklif gönderebilir. Teklifleri yalnızca siz ve teklifi veren alıcı görür. Varsayılan olarak kapalıdır.</p>
        {state.error && <div className="pt-o-alert" role="alert" data-testid={`status-offer-error-${id}`}>{state.error}</div>}
        {state.actionError && <div className="pt-o-alert" role="alert">{state.actionError}</div>}
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontWeight: 700, fontSize: 14 }}>
          <input type="checkbox" role="switch" style={{ width: 22, height: 22 }} checked={enabled} disabled={locked}
            onChange={e => { void state.toggle(id, e.target.checked); }} data-testid={`switch-offer-enabled-${id}`} />
          {enabled ? 'Teklif alma açık' : 'Teklif alma kapalı'}
        </label>
        <button type="button" className="pt-o-btn" onClick={onViewOffers} data-testid={`button-view-offers-owner-${id}`}>Tekliflerimi gör</button>
      </section>
    );
  }

  if (!enabled && !inCatalog) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || locked) return;
    const ok = await state.submit(id, { amount: amt, quantity: quantity.trim(), note: note.trim(), phone: phone.trim() });
    if (ok) { setSent(true); setAmount(''); setQuantity(''); setNote(''); }
  };

  return (
    <section className="pt-offer-controls pt-offers" style={{ background: '#fffef9', padding: 16 }} aria-labelledby={`oc-t-${id}`} data-testid={`panel-offer-buyer-${id}`}>
      <h3 id={`oc-t-${id}`}>Satıcıya özel teklif ver</h3>
      <p className="pt-o-note">Bu satıcı bu ürün için pazarlığa açık. Teklifiniz yalnızca satıcıya iletilir. Ödeme veya sipariş işlemi bu sitede yapılmaz.</p>
      {state.error && <div className="pt-o-alert" role="alert" data-testid={`status-offer-error-${id}`}>{state.error}</div>}
      {!session ? (
        <button type="button" className="pt-o-btn dark" onClick={onSignIn} data-testid={`button-offer-signin-${id}`}>Teklif vermek için giriş yapın</button>
       ) : openOffer ? (
         <div><p className="pt-o-note">Bu ilan için yanıt bekleyen teklifiniz var.</p><button type="button" className="pt-o-btn" onClick={onViewOffers}>Teklifimi gör</button></div>
       ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          <div className="pt-o-row">
            <label className="pt-o-field" style={{ flex: '1 1 140px' }}>Teklifiniz (TL)
              <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required data-testid={`input-offer-amount-${id}`} />
            </label>
            <label className="pt-o-field" style={{ flex: '1 1 140px' }}>Miktar
               <input value={quantity} maxLength={80} onChange={e => setQuantity(e.target.value)} placeholder="örn. 2 ton" required data-testid={`input-offer-quantity-${id}`} />
            </label>
          </div>
          <label className="pt-o-field">Telefon (kabulden sonra paylaşılır)
             <input type="tel" maxLength={24} required value={phone} onChange={e => setPhone(e.target.value)} data-testid={`input-offer-phone-${id}`} />
          </label>
          <label className="pt-o-field">Not
             <textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} data-testid={`input-offer-note-${id}`} />
          </label>
          {state.actionError && <div className="pt-o-alert" role="alert" data-testid={`status-offer-action-error-${id}`}>{state.actionError}</div>}
          {sent && !state.actionError && <div role="status" className="pt-o-note" data-testid={`status-offer-sent-${id}`}>Teklifiniz iletildi. Yanıtı tekliflerim sayfasında görebilirsiniz.</div>}
          <div className="pt-o-row">
            <button type="submit" className="pt-o-btn dark" disabled={locked || !valid} data-testid={`button-offer-submit-${id}`}>{state.busy ? 'Gönderiliyor…' : 'Teklifi gönder'}</button>
            <button type="button" className="pt-o-btn" onClick={onViewOffers} data-testid={`button-view-offers-buyer-${id}`}>Tekliflerim</button>
          </div>
        </form>
      )}
    </section>
  );
}
