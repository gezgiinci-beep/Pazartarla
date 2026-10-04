import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AlertCircle, ArrowLeft, Check, ExternalLink, Film, Image as ImageIcon, Plus, RefreshCw, Save, Trash2, UploadCloud, X } from 'lucide-react';
import { AD_ACCEPT, adFile } from '../lib/advertisements';
import type { Advertisement, AdvertisementDraft } from '../lib/advertisements';
import type { useAdvertisements } from '../hooks/useAdvertisements';
import './advertisements.css';

type AdvertisementState = ReturnType<typeof useAdvertisements>;
type Props = { state: AdvertisementState; onBack: () => void };

function createDraft(): AdvertisementDraft {
  return { id: crypto.randomUUID(), title: '', target_url: '', is_active: true, file: null, existing: null };
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function AdvertisementManager({ state, onBack }: Props) {
  const { items, loading, error, saveError, success, warning, busy, refresh, save, remove, retryCleanup, mediaUrl } = state;
  const [draft, setDraft] = useState<AdvertisementDraft>(createDraft);
  const [formError, setFormError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [mediaFailures, setMediaFailures] = useState<string[]>([]);

  useEffect(() => {
    if (!draft.file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(draft.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);

  const isEditing = draft.existing !== null;
  const resetDraft = () => {
    setDraft(createDraft());
    setFormError('');
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      adFile(file);
      setDraft(current => ({ ...current, file }));
      setFormError('');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Dosya biçimi veya boyutu uygun değil.');
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    if (!draft.existing && !draft.file) {
      setFormError('Reklam için bir görsel veya video seçin.');
      return;
    }
    if (draft.file) {
      try { adFile(draft.file); }
      catch (cause) {
        setFormError(cause instanceof Error ? cause.message : 'Dosya biçimi veya boyutu uygun değil.');
        return;
      }
    }
    const saved = await save(draft);
    if (saved) resetDraft();
  };

  const edit = (ad: Advertisement) => {
    setDraft({
      id: ad.id,
      title: ad.title,
      target_url: ad.target_url ?? '',
      is_active: ad.is_active,
      file: null,
      existing: { ...ad },
    });
    setFormError('');
  };

  const togglePublished = async (ad: Advertisement) => {
    await save({
      id: ad.id,
      title: ad.title,
      target_url: ad.target_url ?? '',
      is_active: !ad.is_active,
      file: null,
      existing: ad,
    });
  };

  const deleteAd = async (ad: Advertisement) => {
    const confirmed = window.confirm(
      `“${ad.title}” reklamı silinsin mi?\n\nBu işlem reklam kaydını ve bağlı görsel/video dosyasını siler.`
    );
    if (!confirmed) return;
    if (await remove(ad)) {
      if (draft.existing?.id === ad.id) resetDraft();
    }
  };

  const markMediaFailure = (id: string) => {
    setMediaFailures(current => current.includes(id) ? current : [...current, id]);
  };

  return (
    <section className="pt-ad pt-ad-manager" aria-labelledby="pt-ad-manager-title">
      <header className="pt-ad-header">
        <div className="pt-ad-heading">
          <div className="pt-ad-mark" aria-hidden="true"><ImageIcon size={20} /></div>
          <div>
            <p className="pt-ad-kicker">PazarTarla · Tanıtım alanı</p>
            <h1 className="pt-ad-title" id="pt-ad-manager-title">Reklam yönetimi</h1>
            <p className="pt-ad-intro">Görsel ve video tanıtımlarını buradan yayınlayıp düzenleyin.</p>
          </div>
        </div>
        <button className="pt-ad-button" type="button" onClick={onBack} disabled={busy} data-testid="button-back-advertisements">
          <ArrowLeft size={15} /> Geri
        </button>
      </header>

      <div className="pt-ad-toolbar" aria-label="Reklam listesi işlemleri">
        <button className="pt-ad-button" type="button" onClick={() => { void refresh(); }} disabled={busy || loading} data-testid="button-refresh-advertisements">
          <RefreshCw size={14} /> Listeyi yenile
        </button>
        <button className="pt-ad-button" type="button" onClick={resetDraft} disabled={busy} data-testid="button-new-advertisement">
          <Plus size={14} /> Yeni reklam
        </button>
        {warning && state.canCleanup && (
          <button className="pt-ad-button" type="button" onClick={() => { void retryCleanup(); }} disabled={busy} data-testid="button-retry-ad-cleanup">
            <RefreshCw size={14} /> Dosya temizliğini yeniden dene
          </button>
        )}
      </div>

      {error && (
        <div className="pt-ad-feedback pt-ad-feedback-error" role="alert" data-testid="error-advertisement-list">
          <AlertCircle size={16} /> <span>{error}</span>
          <button className="pt-ad-small-button" type="button" onClick={() => { void refresh(); }} disabled={busy}>Yeniden dene</button>
        </div>
      )}
      {saveError && <div className="pt-ad-feedback pt-ad-feedback-error" role="alert" aria-live="assertive" data-testid="error-advertisement-save"><AlertCircle size={16} /><span>{saveError}</span></div>}
      {success && <div className="pt-ad-feedback" role="status" aria-live="polite" data-testid="status-advertisement-success"><Check size={16} /><span>{success}</span></div>}
      {warning && <div className="pt-ad-feedback pt-ad-feedback-warning" role="status" aria-live="polite" data-testid="warning-advertisement-cleanup"><AlertCircle size={16} /><span>{warning}</span></div>}

      <div className="pt-ad-layout" style={{ marginTop: 16 }}>
        <section className="pt-ad-panel" aria-labelledby="pt-ad-form-heading">
          <h2 className="pt-ad-panel-title" id="pt-ad-form-heading">{isEditing ? 'Reklamı düzenle' : 'Yeni reklam oluştur'}</h2>
          <form className="pt-ad-form" onSubmit={(event) => { void submit(event); }}>
            <label className="pt-ad-field" htmlFor="pt-ad-title">
              Reklam başlığı
              <input id="pt-ad-title" type="text" maxLength={120} required value={draft.title} disabled={busy}
                onChange={event => { const title = event.currentTarget.value; setDraft(current => ({ ...current, title })); }}
                placeholder="Örn. Bu haftanın yerel ürünleri" data-testid="input-advertisement-title" />
              <span className="pt-ad-help">{draft.title.length}/120 karakter</span>
            </label>

            <label className="pt-ad-field" htmlFor="pt-ad-target-url">
              Hedef bağlantı <span className="pt-ad-help">(isteğe bağlı)</span>
              <input id="pt-ad-target-url" type="url" value={draft.target_url} disabled={busy}
                onChange={event => { const target_url = event.currentTarget.value; setDraft(current => ({ ...current, target_url })); }}
                placeholder="https://ornek.com" data-testid="input-advertisement-target-url" />
              <span className="pt-ad-help">Tıklayan ziyaretçi bu adrese gider. Yalnızca http/https adresleri kabul edilir.</span>
            </label>

            {!isEditing && (
              <div className="pt-ad-field">
                <span>Görsel veya video</span>
                <label className="pt-ad-upload" htmlFor="pt-ad-file">
                  <UploadCloud size={21} aria-hidden="true" />
                  <strong>{draft.file ? draft.file.name : 'Dosya seçmek için dokunun'}</strong>
                  <span>JPG, PNG, WEBP · en fazla 10 MB</span>
                  <span>MP4, WEBM · en fazla 50 MB</span>
                  <input id="pt-ad-file" type="file" accept={AD_ACCEPT} onChange={chooseFile} disabled={busy} data-testid="input-advertisement-file" />
                </label>
                {draft.file && (
                  <>
                    {draft.file.type.startsWith('video/') ? (
                      <video className="pt-ad-preview" src={previewUrl} controls playsInline preload="metadata" aria-label={`${draft.title || 'Yeni reklam'} video önizlemesi`} onError={() => setFormError('Video önizlemesi açılamadı. Başka bir dosya deneyin.')} />
                    ) : (
                      <img className="pt-ad-preview" src={previewUrl} alt={`${draft.title || 'Yeni reklam'} görsel önizlemesi`} onError={() => setFormError('Görsel önizlemesi açılamadı. Başka bir dosya deneyin.')} />
                    )}
                    <span className="pt-ad-help">Seçilen dosya: {formatSize(draft.file.size)}</span>
                  </>
                )}
              </div>
            )}
            {isEditing && (
              <div className="pt-ad-feedback">
                {draft.existing?.media_type === 'video' ? <Film size={15} /> : <ImageIcon size={15} />}
                <span>Mevcut medya korunur. Bu düzenlemede dosya değiştirilemez.</span>
              </div>
            )}

            <div className="pt-ad-status-line">
              <button className="pt-ad-switch" type="button" role="switch" aria-checked={draft.is_active}
                aria-label={draft.is_active ? 'Reklam yayında' : 'Reklam duraklatıldı'}
                onClick={() => setDraft(current => ({ ...current, is_active: !current.is_active }))}
                disabled={busy} data-testid="switch-advertisement-publish">
                <span className="pt-ad-switch-track" aria-hidden="true"><span className="pt-ad-switch-thumb" /></span>
                <span>{draft.is_active ? 'Yayında' : 'Duraklatıldı'}</span>
              </button>
              <span className={`pt-ad-status ${draft.is_active ? 'pt-ad-status-live' : ''}`} role="status" aria-live="polite">
                {draft.is_active ? 'Yayınlanacak' : 'Gizli kalacak'}
              </span>
            </div>

            {formError && <div className="pt-ad-feedback pt-ad-feedback-error" role="alert" data-testid="error-advertisement-form"><AlertCircle size={16} /><span>{formError}</span></div>}
            <div className="pt-ad-actions">
              <button className="pt-ad-button pt-ad-button-primary" type="submit" disabled={busy} data-testid="button-save-advertisement">
                <Save size={14} /> {busy ? 'Kaydediliyor…' : isEditing ? 'Değişiklikleri kaydet' : 'Reklamı kaydet'}
              </button>
              {isEditing && <button className="pt-ad-button" type="button" onClick={resetDraft} disabled={busy} data-testid="button-cancel-edit-advertisement"><X size={14} /> Vazgeç</button>}
            </div>
          </form>
          <p className="pt-ad-note">Reklamı duraklatmak yalnızca sayfadaki gösterimi gizler. Medya bağlantıları herkese açıktır; bu nedenle dosya URL’si doğrudan görüntülenebilir.</p>
        </section>

        <section className="pt-ad-panel" aria-labelledby="pt-ad-list-heading">
          <div className="pt-ad-row-head" style={{ marginBottom: 13 }}>
            <h2 className="pt-ad-panel-title" id="pt-ad-list-heading" style={{ margin: 0 }}>Reklamlar <span className="pt-ad-help">({items.length})</span></h2>
            <span className="pt-ad-help" role="status" aria-live="polite">{busy ? 'İşlem sürüyor…' : 'Yayın durumunu anında değiştirebilirsiniz.'}</span>
          </div>
          {loading ? (
            <div className="pt-ad-list" aria-label="Reklamlar yükleniyor" aria-busy="true">
              <div className="pt-ad-skeleton" /><div className="pt-ad-skeleton" /><div className="pt-ad-skeleton" />
            </div>
          ) : error && items.length === 0 ? (
            <div className="pt-ad-empty">
              <AlertCircle size={21} />
              <strong>Reklam listesi alınamadı</strong>
              <span>Bağlantınızı kontrol edip listeyi yeniden yükleyin.</span>
              <button className="pt-ad-button" type="button" onClick={() => { void refresh(); }} disabled={busy}>Yeniden dene</button>
            </div>
          ) : items.length === 0 ? (
            <div className="pt-ad-empty">
              <ImageIcon size={22} />
              <strong>Henüz reklam yok</strong>
              <span>İlk tanıtımınızı oluşturmak için soldaki formu kullanın.</span>
            </div>
          ) : (
            <div className="pt-ad-list">
              {items.map(ad => {
                const source = mediaUrl(ad);
                const mediaBroken = mediaFailures.includes(ad.id);
                return (
                  <article className="pt-ad-row" key={ad.id} data-testid={`card-advertisement-${ad.id}`}>
                    <div className="pt-ad-thumb">
                      {mediaBroken ? <span className="pt-ad-media-error" role="status">Medya yüklenemedi</span> : ad.media_type === 'video' ? (
                        <video src={source} controls playsInline preload="metadata" aria-label={`${ad.title} video önizlemesi`} onError={() => markMediaFailure(ad.id)} />
                      ) : (
                        <img src={source} alt={ad.title} loading="lazy" onError={() => markMediaFailure(ad.id)} />
                      )}
                    </div>
                    <div className="pt-ad-row-content">
                      <div className="pt-ad-row-head">
                        <h3 className="pt-ad-row-title" title={ad.title}>{ad.title}</h3>
                        <span className={`pt-ad-status ${ad.is_active ? 'pt-ad-status-live' : ''}`} role="status" aria-live="polite">{ad.is_active ? 'Yayında' : 'Duraklatıldı'}</span>
                      </div>
                      {ad.target_url && <a className="pt-ad-row-link" href={ad.target_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> {ad.target_url}</a>}
                      <div className="pt-ad-actions">
                        <button className="pt-ad-small-button" type="button" onClick={() => { void togglePublished(ad); }} disabled={busy} aria-label={ad.is_active ? `${ad.title} reklamını duraklat` : `${ad.title} reklamını yayınla`} data-testid={`button-toggle-advertisement-${ad.id}`}>
                          {ad.is_active ? 'Duraklat' : 'Yayınla'}
                        </button>
                        <button className="pt-ad-small-button" type="button" onClick={() => edit(ad)} disabled={busy} data-testid={`button-edit-advertisement-${ad.id}`}>Düzenle</button>
                        <button className="pt-ad-small-button" type="button" onClick={() => { void deleteAd(ad); }} disabled={busy} data-testid={`button-delete-advertisement-${ad.id}`} aria-label={`${ad.title} reklamını ve medyasını sil`}><Trash2 size={12} /> Sil</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}