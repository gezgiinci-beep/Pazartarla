import { useEffect, useState } from 'react';
import type { Advertisement } from '../lib/advertisements';
import './sponsors.css';

type Props = {
  state: {
    items: Advertisement[];
    loading: boolean;
    error: string;
    refresh: () => void;
    mediaUrl: (ad: Advertisement) => string;
  };
  admin: boolean;
  onManage: () => void;
};

export default function SponsorPartners({ state, admin, onManage }: Props) {
  const [failedMedia, setFailedMedia] = useState<string[]>([]);
  useEffect(()=>{setFailedMedia([]);},[state.items]);
  const activeSponsors = state.items.filter(ad => ad.is_active && ad.media_type === 'image');

  if (!activeSponsors.length && !admin && !state.loading && !state.error) return null;

  const markFailed = (id: string) => {
    setFailedMedia(current => current.includes(id) ? current : [...current, id]);
  };

  return (
    <section className="pt-sponsors" aria-labelledby="pt-sponsors-title">
      <div className="pt-sponsors-inner">
        <header className="pt-sponsors-heading">
          <div className="pt-sponsors-title-group">
            <p className="pt-sponsors-eyebrow">PazarTarla iş birliği ağı</p>
            <h2 className="pt-sponsors-title" id="pt-sponsors-title">Sponsorlar / Çözüm Ortaklarımız</h2>
            <p className="pt-sponsors-intro">
              Tarımın üretimden pazara uzanan yolculuğuna katkı sunan çözüm ortaklarımız.
            </p>
          </div>
          {admin && (
            <button
              className="pt-sponsors-admin-action"
              type="button"
              onClick={onManage}
              data-testid="button-manage-sponsors"
            >
              Sponsorları yönet
            </button>
          )}
        </header>

        {state.error && (
          <div className="pt-sponsors-feedback" role="alert" data-testid="status-sponsors-error">
            <p>{state.error}</p>
            <button
              className="pt-sponsors-retry"
              type="button"
              onClick={() => { void state.refresh(); }}
              data-testid="button-retry-sponsors"
            >
              Yeniden dene
            </button>
          </div>
        )}

        {state.loading ? (
          <div className="pt-sponsors-loading" role="status" aria-label="Çözüm ortakları yükleniyor">
            <span className="pt-sponsors-skeleton" />
            <span className="pt-sponsors-skeleton" />
            <span className="pt-sponsors-skeleton" />
            <span className="pt-sponsors-skeleton" />
          </div>
        ) : activeSponsors.length > 0 ? (
          <div className="pt-sponsors-grid">
            {activeSponsors.map(ad => {
              const broken = failedMedia.includes(ad.id);
              const src = state.mediaUrl(ad);
              const image = broken ? (
                <span className="pt-sponsor-failure" role="status" aria-live="polite">
                  <strong>Görsel gösterilemiyor</strong>
                  <span>{ad.title} görseli yüklenemedi.</span>
                </span>
              ) : (
                <img
                  className="pt-sponsor-image"
                  src={src}
                  alt={ad.title}
                  loading="lazy"
                  decoding="async"
                  onError={() => markFailed(ad.id)}
                  data-testid={`img-sponsor-${ad.id}`}
                />
              );

              return (
                <article className="pt-sponsor-card" key={ad.id} data-testid={`card-sponsor-${ad.id}`}>
                  {ad.target_url ? (
                    <a
                      className="pt-sponsor-card-link"
                      href={ad.target_url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      title={`${ad.title} — yeni sekmede açılır`}
                      aria-label={`${ad.title}; sponsor bağlantısını yeni sekmede aç`}
                      data-testid={`link-sponsor-${ad.id}`}
                    >
                      {image}
                    </a>
                  ) : (
                    <div className="pt-sponsor-card-link" aria-label={`${ad.title}, bağlantı yok`}>
                      {image}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : admin && !state.loading && !state.error ? (
          <div className="pt-sponsors-empty" data-testid="empty-sponsors">
            <div className="pt-sponsors-empty-copy">
              <strong>Henüz yayındaki bir sponsor yok</strong>
              <span>Görsel sponsorları buradan ekleyip yayın durumlarını yönetebilirsiniz.</span>
            </div>
            <button
              className="pt-sponsors-admin-action"
              type="button"
              onClick={onManage}
              data-testid="button-add-sponsor"
            >
              Sponsor ekle / yönet
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}