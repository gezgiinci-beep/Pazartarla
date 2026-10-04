import { useState } from 'react';
import { ExternalLink, Megaphone, Settings2 } from 'lucide-react';
import type { useAdvertisements } from '../hooks/useAdvertisements';
import './advertisements.css';

type AdvertisementState = ReturnType<typeof useAdvertisements>;
type Props = { state: AdvertisementState; admin: boolean; onManage: () => void };

export default function AdvertisementPlacement({ state, admin, onManage }: Props) {
  const [failedMedia, setFailedMedia] = useState<string[]>([]);
  const activeItems = state.items.filter(ad => ad.is_active);

  if (!activeItems.length && !admin && !state.loading && !state.error) return null;

  const markFailed = (id: string) => {
    setFailedMedia(current => current.includes(id) ? current : [...current, id]);
  };

  return (
    <section className="pt-ad pt-ad-placement" aria-label="Sponsorlu tanıtımlar">
      {state.loading && <p role="status">Tanıtımlar yükleniyor…</p>}
      {state.error && <div className="pt-ad-feedback pt-ad-feedback-error" role="alert">
        <span>{state.error}</span>
        <button type="button" className="pt-ad-small-button" onClick={() => { void state.refresh(); }} disabled={state.busy}>Yeniden dene</button>
      </div>}
      {admin && (
        <div className="pt-ad-row-head">
          <span className="pt-ad-kicker" style={{ margin: 0 }}>Reklam alanı · yalnızca yayındakiler</span>
          <button className="pt-ad-button" type="button" onClick={onManage} data-testid="button-manage-advertisements">
            <Settings2 size={14} /> Reklamları yönet
          </button>
        </div>
      )}
      {activeItems.length > 0 ? (
        <div className="pt-ad-placement-grid">
          {activeItems.map(ad => {
            const src = state.mediaUrl(ad);
            const broken = failedMedia.includes(ad.id);
            return (
              <article className="pt-ad-placement-card" key={ad.id} data-testid={`placement-advertisement-${ad.id}`}>
                {broken ? (
                  <div className="pt-ad-media-error" role="status" aria-live="polite">Tanıtım medyası yüklenemedi. Lütfen daha sonra tekrar deneyin.</div>
                ) : ad.media_type === 'video' ? (
                  <video
                    className="pt-ad-placement-media"
                    src={src}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={`${ad.title} tanıtım videosu`}
                    onError={() => markFailed(ad.id)}
                  />
                ) : (
                  <img
                    className="pt-ad-placement-media"
                    src={src}
                    alt={ad.title}
                    loading="lazy"
                    onError={() => markFailed(ad.id)}
                  />
                )}
                <div className="pt-ad-placement-body">
                  <h2 className="pt-ad-placement-title">{ad.title}</h2>
                  {ad.target_url && (
                    <a className="pt-ad-visit" href={ad.target_url} target="_blank" rel="noopener noreferrer" aria-label={`${ad.title} bağlantısını yeni sekmede aç`}>
                      Ziyaret et <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : admin && !state.loading && !state.error ? (
        <div className="pt-ad-empty">
          <Megaphone size={20} />
          <strong>Yayında reklam yok</strong>
          <span>Burada yalnızca yayına alınmış tanıtımlar gösterilir.</span>
        </div>
      ) : null}
    </section>
  );
}