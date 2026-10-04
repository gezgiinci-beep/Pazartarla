import { useEffect, useState } from 'react';
import type { useSiteSettings } from '../hooks/useSiteSettings';
import { validFeaturedOffer } from '../lib/siteSettings';
import FeaturedOfferNotice from './FeaturedOfferNotice';
import './featured-offer.css';

type SettingsState = ReturnType<typeof useSiteSettings>;
type OfferDraft = { price: string; description: string };

function asDraft(price: number, description: string): OfferDraft {
  return { price: String(price), description };
}

export default function FeaturedOfferManager({ state }: { state: SettingsState }) {
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const canonical = state.settings?.featured_offer;
  const revision = state.settings?.revision;

  useEffect(() => {
    if (canonical && revision !== undefined && draftRevision === null) {
      setDraft(asDraft(canonical.monthly_price_try, canonical.description));
    }
  }, [canonical, revision, draftRevision]);

  const ready = !!canonical && state.editable && draft !== null;
  const numericPrice = draft ? Number(draft.price) : NaN;
  const valid = !!draft && validFeaturedOffer({
    monthly_price_try: numericPrice,
    description: draft.description
  });
  const dirty = draftRevision !== null;
  const stale = dirty && revision !== undefined && draftRevision !== null && revision > draftRevision;

  function updateDraft(next: OfferDraft) {
    if (!canonical || revision === undefined) return;
    const matchesCanonical = Number(next.price) === canonical.monthly_price_try &&
      next.description === canonical.description;
    setDraft(next);
    setDraftRevision(matchesCanonical ? null : current => current ?? revision);
  }

  function loadCanonical() {
    if (!canonical || revision === undefined || state.saving) return;
    setDraft(asDraft(canonical.monthly_price_try, canonical.description));
    setDraftRevision(null);
  }

  async function save() {
    if (!valid || !draft || draftRevision === null || !ready || state.saving) return;
    const saved = await state.save({
      featured_offer: {
        monthly_price_try: Number(draft.price),
        description: draft.description
      }
    }, 'Vitrin ücreti ve açıklaması kaydedildi.', draftRevision);
    if (saved) {
      setDraft(asDraft(saved.featured_offer.monthly_price_try, saved.featured_offer.description));
      setDraftRevision(null);
    }
  }

  const previewOffer = draft && valid
    ? {
      monthly_price_try: numericPrice,
      description: draft.description
    }
    : draft ? null : canonical;

  return (
    <section className="pto-manager" aria-labelledby="pto-manager-title" data-testid="featured-offer-manager">
      <header className="pto-manager__header">
        <div>
          <div className="pto-manager__eyebrow">YÖNETİM · PAZARTARLA</div>
          <h2 id="pto-manager-title">Vitrin Ücreti</h2>
          <p>Aylık ücret ve ilanda görünecek açıklamayı yönetin.</p>
        </div>
        <span className="pto-manager__badge">1 aylık dönem</span>
      </header>

      {state.loading && !canonical && (
        <div className="pto-manager__loading" role="status" data-testid="status-featured-offer-loading">
          <span className="pto-skeleton pto-skeleton--short" />
          <span className="pto-skeleton" />
          <span className="pto-skeleton pto-skeleton--wide" />
          <span className="pto-skeleton pto-skeleton--button" />
          <span className="pto-manager__loading-label">Sunucudaki vitrin ayarı yükleniyor…</span>
        </div>
      )}

      {state.loadError && (
        <div className="pto-manager__alert pto-manager__alert--error" role="alert" data-testid="status-featured-offer-load-error">
          <span>{state.loadError}</span>
          <button type="button" onClick={() => void state.refresh()} disabled={state.loading || state.saving} data-testid="button-retry-featured-offer-load">
            Yeniden yükle
          </button>
        </div>
      )}

      {canonical && draft && (
        <>
          {stale && (
            <div className="pto-manager__alert pto-manager__alert--stale" role="status" data-testid="status-featured-offer-stale">
              <span>Bu taslak, sunucudaki ayarlar değişmeden önce açıldı. Kaydetmeden önce güncel değerleri kontrol edin.</span>
              <button type="button" onClick={loadCanonical} disabled={state.saving} data-testid="button-load-canonical-featured-offer">
                Sunucudaki güncel değerleri al
              </button>
            </div>
          )}

          <div className="pto-manager__layout">
            <div className="pto-manager__form">
              <label className="pto-manager__field" htmlFor="pto-monthly-price">
                <span>Aylık vitrin ücreti</span>
                <div className="pto-manager__price-input">
                  <input
                    id="pto-monthly-price"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    value={draft.price}
                    onChange={event => updateDraft({ ...draft, price: event.target.value })}
                    disabled={!ready || state.saving}
                    aria-describedby="pto-price-help"
                    data-testid="input-featured-offer-price"
                  />
                  <span>TL</span>
                </div>
                <small id="pto-price-help">0,01–1.000.000 TL · en fazla iki ondalık basamak</small>
              </label>

              <label className="pto-manager__field" htmlFor="pto-offer-description">
                <span>İlanlarda gösterilecek açıklama</span>
                <textarea
                  id="pto-offer-description"
                  value={draft.description}
                  maxLength={400}
                  rows={4}
                  onChange={event => updateDraft({ ...draft, description: event.target.value })}
                  disabled={!ready || state.saving}
                  placeholder="Vitrin hizmeti hakkında kısa bilgi"
                  data-testid="input-featured-offer-description"
                />
                <small className="pto-manager__counter">{draft.description.length}/400 karakter</small>
              </label>

              {!valid && (
                <p className="pto-manager__validation" role="alert" data-testid="text-featured-offer-validation">
                  Ücret 0’dan büyük, en fazla 1.000.000 TL ve iki ondalık basamaklı olmalı. Açıklama en fazla 400 karakter olabilir.
                </p>
              )}

              {state.saveError && (
                <p className="pto-manager__alert pto-manager__alert--error" role="alert" data-testid="status-featured-offer-save-error">
                  {state.saveError}
                </p>
              )}
              {state.success === 'Vitrin ücreti ve açıklaması kaydedildi.' && (
                <p className="pto-manager__alert pto-manager__alert--success" role="status" data-testid="status-featured-offer-save-success">
                  {state.success}
                </p>
              )}

              <div className="pto-manager__actions">
                <button
                  className="pto-manager__save"
                  type="button"
                  onClick={() => void save()}
                  disabled={!ready || !dirty || !valid || state.saving}
                  data-testid="button-save-featured-offer"
                >
                  {state.saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                </button>
                {dirty && !state.saving && (
                  <button className="pto-manager__reset" type="button" onClick={loadCanonical} data-testid="button-discard-featured-offer">
                    Taslağı bırak
                  </button>
                )}
              </div>
              <p className="pto-manager__note">Bu ayar yalnızca fiyat bilgisini ve talep açıklamasını yönetir; ödeme veya otomatik öne çıkarma başlatmaz.</p>
            </div>

            <aside className="pto-manager__preview" aria-label="Ziyaretçi görünümü önizlemesi">
              <div className="pto-manager__preview-heading">
                <span>CANLI ÖNİZLEME</span>
                <span className="pto-manager__preview-dot" />
              </div>
              {previewOffer ? (
                <FeaturedOfferNotice offer={previewOffer} />
              ) : (
                <div className="pto-manager__preview-empty">Geçerli bir ücret girildiğinde önizleme burada görünür.</div>
              )}
            </aside>
          </div>
        </>
      )}

      {!canonical && !state.loading && !state.loadError && (
        <div className="pto-manager__alert pto-manager__alert--error" role="alert" data-testid="status-featured-offer-unavailable">
          Sunucudan geçerli vitrin ayarı alınamadı. Alanlar, gerçek ayar yüklenene kadar kullanılamaz.
        </div>
      )}
    </section>
  );
}