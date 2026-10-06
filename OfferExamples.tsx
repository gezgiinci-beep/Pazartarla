import { useEffect, useRef, useState } from 'react';
import { offerExamples } from '../lib/offerExamples';
import './offer-examples.css';

const price = (value: number) => value.toLocaleString('tr-TR') + ' TL';

export default function OfferExamples() {
  const [selected, setSelected] = useState<(typeof offerExamples)[number] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selected) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [selected]);

  return (
    <section className="pt-offer-examples" aria-label="Temsili teklif ilanları" data-testid="offer-examples">
      <aside className="pt-offer-demo-banner" role="note">
        <strong>DEMO / ÖRNEK · 8 TEMSİLİ İLAN</strong>
        <p>Bu kartlar örnektir; gerçek satıcı, stok veya teklif değildir. Örneklerden teklif gönderilmez, iletişim kurulmaz ve ödeme yapılmaz.</p>
      </aside>
      <div className="pt-o-grid">
        {offerExamples.map(item => (
          <button type="button" key={item.id} className="pt-o-card" onClick={() => setSelected(item)} data-testid={`offer-example-${item.id}`}>
            <img src={item.image} alt={`${item.title} için temsili çizim`} loading="lazy" width={360} height={240} />
            <span className="body">
              <span className="pt-o-badge">Demo / Örnek</span>
              <strong>{item.title}</strong>
              <span>{item.category} · {item.location}</span>
              <b>{price(item.price)}</b>
            </span>
          </button>
        ))}
      </div>
      <dialog ref={dialog} className="pt-offer-demo-dialog" aria-labelledby="offer-example-title"
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        onClose={() => { setSelected(null); previousFocus.current?.focus(); }}>
        {selected && <>
          <button type="button" className="pt-o-btn" onClick={() => dialog.current?.close()} autoFocus>Kapat</button>
          <img src={selected.image} alt="Temsili örnek çizim" width={360} height={240} />
          <span className="pt-o-badge">Demo / Örnek — satışa açık değildir</span>
          <h2 id="offer-example-title">{selected.title}</h2>
          <p>{selected.category} · {selected.location}</p>
          <p><strong>{price(selected.price)}</strong> / {selected.quantity}</p>
          <p>{selected.description}</p>
          <p>Örnek ilanda teklif gönderilmez, satıcıyla iletişim kurulmaz ve ödeme yapılmaz.</p>
          <button type="button" className="pt-o-btn dark" disabled>Örnek ilan — teklif gönderilemez</button>
        </>}
      </dialog>
    </section>
  );
}
