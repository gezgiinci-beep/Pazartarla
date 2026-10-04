import type { FeaturedOffer } from '../lib/siteSettings';
import './featured-offer.css';

function formatTry(amount: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(amount) + ' TL';
}

export default function FeaturedOfferNotice({
  offer,
  onRequest
}: {
  offer: FeaturedOffer;
  onRequest?: () => void;
}) {
  return (
    <section className="pto-notice" aria-labelledby="pto-notice-title" data-testid="featured-offer-notice">
      <div className="pto-notice__ornament" aria-hidden="true">
        <span className="pto-notice__sun" />
        <span className="pto-notice__ridge pto-notice__ridge--back" />
        <span className="pto-notice__ridge pto-notice__ridge--front" />
        <span className="pto-notice__grain">PT</span>
      </div>
      <div className="pto-notice__body">
        <div className="pto-notice__eyebrow"><span /> PAZARTARLA VİTRİNİ</div>
        <div className="pto-notice__main">
          <div className="pto-notice__copy">
            <h2 id="pto-notice-title">Ürününüzü daha çok kişiye gösterin.</h2>
            <p>{offer.description}</p>
          </div>
          <div className="pto-notice__price" data-testid="text-featured-offer-price">
            <strong>{formatTry(offer.monthly_price_try)}</strong>
            <span>1 aylık öne çıkarma</span>
          </div>
        </div>
        <div className="pto-notice__footer">
          <span className="pto-notice__fineprint">Vitrin talebi yönetici tarafından değerlendirilir.</span>
          {onRequest ? (
            <button className="pto-notice__button" type="button" onClick={onRequest} data-testid="button-request-featured-offer">
              Vitrin için bilgi al <span aria-hidden="true">→</span>
            </button>
          ) : (
            <span className="pto-notice__manual">Bilgi ve talep için site yöneticisine ulaşın</span>
          )}
        </div>
      </div>
    </section>
  );
}