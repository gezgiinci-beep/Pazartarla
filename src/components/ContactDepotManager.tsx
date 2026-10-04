import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { useContactDepot } from '../hooks/useContactDepot';
import ContactBulkImport from './ContactBulkImport';
import {
  CHANNELS,
  channelLabel,
  normalizePhone,
  validateContact,
} from '../lib/contactDepot';
import type {
  Campaign,
  CampaignDraft,
  ContactDraft,
  DepotContact,
  MessageChannel,
} from '../lib/contactDepot';
import './contact-depot.css';

type ContactDepotManagerProps = {
  state: ReturnType<typeof useContactDepot>;
  onBack: () => void;
};

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const numberFormat = new Intl.NumberFormat('tr-TR');
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'yerel saat';
const emptyContact: ContactDraft = { id: null, revision: null, name: '', email: '', phone: '' };

function dateLabel(value: string | null) {
  if (!value) return 'Henüz kaydedilmedi';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormat.format(date) : 'Tarih bilinmiyor';
}

function campaignStatus(status: Campaign['status']) {
  const labels: Record<Campaign['status'], string> = {
    blocked_provider: 'Sağlayıcı bekleniyor',
    queued: 'Sırada',
    completed: 'Tamamlandı',
    cancelled: 'İptal edildi',
  };
  return labels[status];
}

function channelIcon(channel: MessageChannel) {
  return channel === 'sms' ? 'S' : channel === 'email' ? '@' : 'W';
}

function LoadingDepot() {
  return (
    <div className="pt-depot__loading" role="status" aria-label="Kişi deposu yükleniyor">
      <div className="pt-depot__skeleton pt-depot__skeleton--title" />
      <div className="pt-depot__skeleton-grid">
        <div className="pt-depot__skeleton" />
        <div className="pt-depot__skeleton" />
        <div className="pt-depot__skeleton" />
      </div>
      <div className="pt-depot__skeleton pt-depot__skeleton--row" />
      <div className="pt-depot__skeleton pt-depot__skeleton--row" />
      <p>Merkezi rehber hazırlanıyor…</p>
    </div>
  );
}

export default function ContactDepotManager({ state, onBack }: ContactDepotManagerProps) {
  const {
    data, loading, busy, error, notice, search, page, archived,
    refresh, searchContacts, setPage, showArchived, saveContact,
    archiveContact, savePermission, createCampaign, cancelCampaign,
  } = state;
  const [searchInput, setSearchInput] = useState(search);
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [contactError, setContactError] = useState('');
  const [permissionTarget, setPermissionTarget] = useState<{
    contact: DepotContact;
    channel: MessageChannel;
    grant: boolean;
  } | null>(null);
  const [evidence, setEvidence] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<{
    contact: DepotContact;
    archived: boolean;
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [campaignError, setCampaignError] = useState('');
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({
    name: '',
    channel: 'sms',
    subject: '',
    body: '',
    scheduled_at: '',
  });
  const activeContactCount = useMemo(
    () => data?.contacts.filter((contact) => !contact.archived).length ?? 0,
    [data],
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchContacts(searchInput.trim());
  }

  function beginContact(contact?: DepotContact) {
    setContactError('');
    setContactDraft(contact
      ? {
        id: contact.id,
        revision: contact.revision,
        name: contact.name,
        email: contact.email ?? '',
        phone: contact.phone ?? contact.raw_phone ?? '',
      }
      : { ...emptyContact });
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contactDraft) return;
    try {
      validateContact(contactDraft);
      setContactError('');
      const saved = await saveContact({
        ...contactDraft,
        name: contactDraft.name.trim(),
        email: contactDraft.email.trim(),
        phone: contactDraft.phone.trim(),
      });
      if (saved) setContactDraft(null);
    } catch (issue) {
      setContactError(issue instanceof Error ? issue.message : 'Bilgileri kontrol edin.');
    }
  }

  function beginPermission(contact: DepotContact, channel: MessageChannel, grant: boolean) {
    setEvidence('');
    setPermissionTarget({ contact, channel, grant });
  }

  async function submitPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permissionTarget) return;
    const proof = evidence.trim();
    if (permissionTarget.grant && proof.length < 4) return;
    const saved = await savePermission(
      permissionTarget.contact.id,
      permissionTarget.contact.revision,
      permissionTarget.channel,
      permissionTarget.grant,
      proof,
    );
    if (saved) setPermissionTarget(null);
  }

  async function confirmArchive() {
    if (!confirmTarget) return;
    const saved = await archiveContact(
      confirmTarget.contact.id,
      confirmTarget.contact.revision,
      confirmTarget.archived,
    );
    if (saved) setConfirmTarget(null);
  }

  function openCampaign() {
    const local = new Date(Date.now() + 60 * 60 * 1000);
    const localValue = new Date(local.getTime() - local.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16);
    setCampaignDraft({
      name: '',
      channel: 'sms',
      subject: '',
      body: '',
      scheduled_at: localValue,
    });
    setCampaignError('');
    setCampaignOpen(true);
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCampaignError('');
    const scheduled = new Date(campaignDraft.scheduled_at);
    if (!campaignDraft.name.trim()) {
      setCampaignError('Kampanya adı gerekli.');
      return;
    }
    if (campaignDraft.channel === 'email' && !campaignDraft.subject.trim()) {
      setCampaignError('E-posta kampanyası için konu gerekli.');
      return;
    }
    if (!campaignDraft.body.trim()) {
      setCampaignError('Mesaj metni gerekli.');
      return;
    }
    if (!campaignDraft.scheduled_at || !Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now()) {
      setCampaignError('İleri bir yerel tarih ve saat seçin.');
      return;
    }
    const saved = await createCampaign({
      ...campaignDraft,
      name: campaignDraft.name.trim(),
      subject: campaignDraft.channel === 'email' ? campaignDraft.subject.trim() : '',
      body: campaignDraft.body.trim(),
      scheduled_at: scheduled.toISOString(),
    });
    if (saved) setCampaignOpen(false);
  }

  const canSubmitPermission = !busy && (!permissionTarget?.grant || evidence.trim().length >= 4);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  const channels = data?.channels ?? [];

  return (
    <section className="pt-depot" aria-labelledby="depot-title">
      <header className="pt-depot__topbar">
        <button type="button" className="pt-depot__back" onClick={onBack} data-testid="button-depot-back">
          <span aria-hidden="true">←</span> Yönetim paneli
        </button>
        <div className="pt-depot__topbar-meta"><span className="pt-depot__secure-mark" aria-hidden="true">●</span> Yönetici alanı</div>
      </header>

      <div className="pt-depot__intro">
        <div className="pt-depot__intro-copy">
          <p className="pt-depot__eyebrow"><span /> PAZARTARLA / MERKEZİ REHBER</p>
          <h1 id="depot-title">İletişim deposu</h1>
          <p className="pt-depot__lede">İlan sahiplerinden oluşan merkezi rehber. İzin kayıtları ayrı tutulur; kayıtlı olmak, mesaj izni anlamına gelmez.</p>
        </div>
        <div className="pt-depot__intro-actions">
          <button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setBulkImportOpen(true)} aria-expanded={bulkImportOpen} aria-controls="pt-bulk-title">
            {bulkImportOpen ? 'Toplu aktarım açık' : 'Dosyadan aktar'}
          </button>
          <button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => void refresh()} disabled={loading} data-testid="button-depot-refresh">
            <span className={loading ? 'pt-depot__refresh-mark is-turning' : 'pt-depot__refresh-mark'} aria-hidden="true">↻</span>
            {loading ? 'Yenileniyor' : 'Yenile'}
          </button>
          <button type="button" className="pt-depot__button pt-depot__button--primary" onClick={() => beginContact()} data-testid="button-contact-create">
            <span aria-hidden="true">＋</span> Kişi ekle
          </button>
        </div>
      </div>

      <aside className="pt-depot__provenance" aria-label="Rehber verisinin kaynağı">
        <span className="pt-depot__provenance-icon" aria-hidden="true">i</span>
        <div>
          <strong>İlan verisi otomatik eşleştirilir</strong>
          <p>Biliniyorsa doğrulanmış hesap e-postası, ilan sahibi ve telefon bilgisi rehbere alınır. Sahibi bulunmayan eski ilanlarda e-posta bilinmiyor olabilir. Aynı e-posta ve telefon hedefi tekilleştirilir. Arşivleme ilanları silmez.</p>
        </div>
      </aside>

      {notice && <div className="pt-depot__notice" role="status" data-testid="status-depot-notice"><span aria-hidden="true">✓</span>{notice}</div>}
      {error && <div className="pt-depot__error" role="alert" data-testid="status-depot-error"><strong>İşlem tamamlanamadı</strong><span>{error}</span><button type="button" onClick={() => void refresh()} data-testid="button-depot-retry">Yeniden dene</button></div>}

      {bulkImportOpen && <ContactBulkImport state={state} onClose={() => setBulkImportOpen(false)} />}

      <section className="pt-depot__channels" aria-labelledby="depot-channels-title">
        <div className="pt-depot__section-heading">
          <div><span className="pt-depot__section-kicker">01 / BAĞLANTILAR</span><h2 id="depot-channels-title">Kanal durumu</h2></div>
          <span className="pt-depot__muted">Gönderim şu an kapalı</span>
        </div>
        <div className="pt-depot__channel-strip">
          {CHANNELS.map((channel) => {
            const setup = channels.find((item) => item.channel === channel);
            const enabled = Boolean(setup?.enabled && setup.provider);
            return (
              <div className="pt-depot__channel" key={channel} data-testid={`status-channel-${channel}`}>
                <span className={`pt-depot__channel-symbol pt-depot__channel-symbol--${channel}`} aria-hidden="true">{channelIcon(channel)}</span>
                <div className="pt-depot__channel-copy"><strong>{channelLabel(channel)}</strong><span>{enabled ? setup?.provider : 'Sağlayıcı bağlı değil'}</span></div>
                <span className={`pt-depot__connection ${enabled ? 'is-ready' : ''}`}><i />{enabled ? 'Bağlı' : 'Bekliyor'}</span>
              </div>
            );
          })}
        </div>
        <p className="pt-depot__channel-footnote">Sağlayıcı bağlantısı ve etkinleştirme daha sonra yapılacak. Bu ekrandan hiçbir mesaj gönderilmez.</p>
      </section>

      <section className="pt-depot__directory" aria-labelledby="depot-directory-title">
        <div className="pt-depot__section-heading pt-depot__section-heading--directory">
          <div><span className="pt-depot__section-kicker">02 / KAYITLAR</span><h2 id="depot-directory-title">Rehber</h2></div>
          {data && <div className="pt-depot__record-count"><strong>{numberFormat.format(data.total)}</strong><span>{archived ? 'arşiv kaydı' : 'bu sayfada aktif'}{!archived && activeContactCount > 0 ? ` · ${numberFormat.format(activeContactCount)} görünür` : ''}</span></div>}
        </div>

        <form className="pt-depot__toolbar" onSubmit={submitSearch} role="search">
          <label className="pt-depot__search">
            <span className="pt-depot__search-icon" aria-hidden="true">⌕</span>
            <span className="pt-depot__sr-only">Ad, e-posta veya telefon ara</span>
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Ad, e-posta veya telefon" data-testid="input-contact-search" />
          </label>
          <button className="pt-depot__button pt-depot__button--search" type="submit" data-testid="button-contact-search">Ara</button>
          <div className="pt-depot__filter" role="group" aria-label="Kişi durumu">
            <button type="button" aria-pressed={!archived} className={!archived ? 'is-selected' : ''} onClick={() => showArchived(false)} data-testid="button-filter-active">Aktif</button>
            <button type="button" aria-pressed={archived} className={archived ? 'is-selected' : ''} onClick={() => showArchived(true)} data-testid="button-filter-archived">Arşiv</button>
          </div>
        </form>

        {loading && !data && <LoadingDepot />}
        {!loading && !error && !data && (
          <div className="pt-depot__empty pt-depot__empty--load">
            <span className="pt-depot__empty-symbol" aria-hidden="true">↻</span>
            <h3>Depo henüz yüklenmedi</h3><p>Yöneticinin rehber kayıtlarını görüntülemek için veriyi alın.</p>
            <button type="button" className="pt-depot__button pt-depot__button--primary" onClick={() => void refresh()} data-testid="button-depot-load">Rehberi yükle</button>
          </div>
        )}
        {data && data.contacts.length === 0 && (
          <div className="pt-depot__empty">
            <span className="pt-depot__empty-rule" />
            <p className="pt-depot__section-kicker">{archived ? 'ARŞİV' : 'ARAMA SONUCU'}</p>
            <h3>{search ? 'Eşleşen kişi yok' : archived ? 'Arşiv boş' : 'Henüz kişi yok'}</h3>
            <p>{search ? 'Arama sözcüğünü değiştirin veya filtreyi temizleyin.' : archived ? 'Arşivlenen kayıtlar burada görünür.' : 'İlanlardan gelen kayıtlar ve manuel eklenen kişiler burada birleşir.'}</p>
            {search && <button type="button" className="pt-depot__text-button" onClick={() => { setSearchInput(''); searchContacts(''); }} data-testid="button-contact-clear-search">Aramayı temizle</button>}
          </div>
        )}
        {data && data.contacts.length > 0 && (
          <div className="pt-depot__contact-list">
            {data.contacts.map((contact) => (
              <article className={`pt-depot__contact ${contact.archived ? 'is-archived' : ''}`} key={contact.id} data-testid={`card-contact-${contact.id}`}>
                <div className="pt-depot__contact-main">
                  <div className="pt-depot__contact-avatar" aria-hidden="true">{contact.name.trim().slice(0, 1).toLocaleUpperCase('tr-TR') || '•'}</div>
                  <div className="pt-depot__identity">
                    <div className="pt-depot__identity-heading">
                      <h3>{contact.name}</h3>
                      {contact.archived && <span className="pt-depot__archive-tag">Arşiv</span>}
                      {contact.from_listing && <span className="pt-depot__source-tag">İlan kaynağı</span>}
                      {contact.manual && <span className="pt-depot__manual-tag">Manuel kayıt</span>}
                    </div>
                    <div className="pt-depot__destinations">
                      <span><b aria-hidden="true">@</b>{contact.email || 'E-posta bilinmiyor'}</span>
                      <span><b aria-hidden="true">+</b>{contact.phone || contact.raw_phone || 'Telefon yok'}</span>
                    </div>
                    {contact.raw_phone && !contact.phone && <p className="pt-depot__raw-phone">Kayıtlı ham telefon geçersiz; düzeltmek için kişiyi düzenleyin.</p>}
                    <p className="pt-depot__record-meta">
                      {contact.listing_count > 0 ? `${numberFormat.format(contact.listing_count)} ilan bağlantısı` : 'İlan bağlantısı yok'}
                      <span aria-hidden="true">·</span> Güncellendi {dateLabel(contact.updated_at)}
                    </p>
                  </div>
                  <div className="pt-depot__contact-actions">
                    <button type="button" className="pt-depot__action-button" onClick={() => beginContact(contact)} data-testid={`button-contact-edit-${contact.id}`}>Düzenle</button>
                    <button type="button" className="pt-depot__action-button pt-depot__action-button--archive" onClick={() => setConfirmTarget({ contact, archived: !contact.archived })} data-testid={`button-contact-archive-${contact.id}`}>
                      {contact.archived ? 'Geri al' : 'Arşivle'}
                    </button>
                  </div>
                </div>
                <div className="pt-depot__permissions">
                  <span className="pt-depot__permissions-label">İLETİŞİM İZNİ</span>
                  {CHANNELS.map((channel) => {
                    const permission = contact.permissions[channel];
                    return (
                      <div className="pt-depot__permission" key={channel}>
                        <span className="pt-depot__permission-channel">{channelLabel(channel)}</span>
                        <span className={`pt-depot__permission-state is-${permission.status}`}>
                          <i />{permission.status === 'granted' ? 'Verildi' : permission.status === 'revoked' ? 'Kapatıldı' : 'Bilinmiyor'}
                        </span>
                        {permission.updated_at && <span className="pt-depot__permission-date">{dateLabel(permission.updated_at)}</span>}
                        {permission.evidence && <span className="pt-depot__evidence" title={permission.evidence}>Kanıt: {permission.evidence}</span>}
                        {!contact.archived && permission.status !== 'granted'
                          ? <button type="button" className="pt-depot__permission-action" onClick={() => beginPermission(contact, channel, true)} data-testid={`button-permission-grant-${channel}-${contact.id}`}>İzin kaydet</button>
                          : !contact.archived && <button type="button" className="pt-depot__permission-action pt-depot__permission-action--revoke" onClick={() => beginPermission(contact, channel, false)} data-testid={`button-permission-revoke-${channel}-${contact.id}`}>İzni kapat</button>}
                      </div>
                    );
                  })}
                  <p className="pt-depot__permission-note">İlan veren olmak veya rehbere manuel eklenmek izin oluşturmaz. Alıcı kendi isteğiyle vazgeçerse sunucu tarafındaki opt-out bağlantısı izni kapatır.</p>
                </div>
              </article>
            ))}
          </div>
        )}
        {data && data.total > 0 && (
          <nav className="pt-depot__pagination" aria-label="Kişi sayfaları">
            <span>{numberFormat.format(page * 50 + 1)}–{numberFormat.format(Math.min((page + 1) * 50, data.total))} / {numberFormat.format(data.total)}</span>
            <div>
              <button type="button" disabled={page <= 0 || loading} onClick={() => setPage(page - 1)} data-testid="button-depot-page-previous">Önceki</button>
              <span>Sayfa {page + 1} / {totalPages}</span>
              <button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(page + 1)} data-testid="button-depot-page-next">Sonraki</button>
            </div>
          </nav>
        )}
      </section>

      <section className="pt-depot__campaigns" aria-labelledby="depot-campaigns-title">
        <div className="pt-depot__section-heading">
          <div><span className="pt-depot__section-kicker">03 / İLETİŞİM PLANI</span><h2 id="depot-campaigns-title">Kampanyalar</h2></div>
          <button type="button" className="pt-depot__button pt-depot__button--primary" onClick={openCampaign} data-testid="button-campaign-create"><span aria-hidden="true">＋</span> Kampanya oluştur</button>
        </div>
        <div className="pt-depot__campaign-warning">
          <span className="pt-depot__warning-mark" aria-hidden="true">!</span>
          <p><strong>Mesaj gönderimi devre dışı.</strong> Kampanya kaydı, sağlayıcı kurulana kadar bekleyen durumunda kalır. Bu arayüz teslimat iddiasında bulunmaz.</p>
        </div>
        {data && data.campaigns.length > 0 ? (
          <div className="pt-depot__campaign-list">
            {data.campaigns.map((campaign) => (
              <article className="pt-depot__campaign" key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
                <div className="pt-depot__campaign-head">
                  <span className={`pt-depot__channel-symbol pt-depot__channel-symbol--${campaign.channel}`} aria-hidden="true">{channelIcon(campaign.channel)}</span>
                  <div className="pt-depot__campaign-title"><h3>{campaign.name}</h3><span>{channelLabel(campaign.channel)}{campaign.channel === 'email' && campaign.subject ? ` · ${campaign.subject}` : ''}</span></div>
                  <span className={`pt-depot__campaign-status is-${campaign.status}`}><i />{campaignStatus(campaign.status)}</span>
                </div>
                <p className="pt-depot__campaign-body">{campaign.body}</p>
                <div className="pt-depot__campaign-meta">
                  <span>Planlanan: {dateLabel(campaign.scheduled_at)} · {browserTimezone}</span>
                  <span>Alıcı {numberFormat.format(campaign.recipients)}</span>
                  <span>Gönderildi {numberFormat.format(campaign.sent)}</span>
                  <span>İptal {numberFormat.format(campaign.cancelled)}</span>
                  <span>Başarısız {numberFormat.format(campaign.failed)}</span>
                  <span>Bilinmiyor {numberFormat.format(campaign.unknown)}</span>
                </div>
                {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
                  <button type="button" className="pt-depot__campaign-cancel" onClick={() => setCancelTarget(campaign)} data-testid={`button-campaign-cancel-${campaign.id}`}>Kampanyayı iptal et</button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="pt-depot__campaign-empty"><span aria-hidden="true">—</span><p>Henüz kampanya kaydı yok.</p><button type="button" className="pt-depot__text-button" onClick={openCampaign} data-testid="button-campaign-create-first">İlk kampanya taslağını oluştur</button></div>
        )}
      </section>

      <footer className="pt-depot__footer">
        <span>PAZARTARLA · GÜVENLİ İLETİŞİM</span>
        <p>Kişi rehberi ilan kayıtlarından ayrı arşivlenir. Arşivleme izinleri kapatır ve bekleyen mesajları iptal eder; ilanlar yerinde kalır.</p>
      </footer>

      {contactDraft && (
        <div className="pt-depot__scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setContactDraft(null); }}>
          <section className="pt-depot__dialog" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title">
            <div className="pt-depot__dialog-top"><span className="pt-depot__section-kicker">{contactDraft.id ? 'KAYDI GÜNCELLE' : 'YENİ KAYIT'}</span><button type="button" className="pt-depot__dialog-close" onClick={() => setContactDraft(null)} aria-label="Pencereyi kapat" data-testid="button-contact-dialog-close">×</button></div>
            <h2 id="contact-dialog-title">{contactDraft.id ? 'Kişiyi düzenle' : 'Rehbere kişi ekle'}</h2>
            <p className="pt-depot__dialog-intro">En az bir iletişim hedefi gereklidir. Manuel kayıt, mesaj izni vermez.</p>
            {contactDraft.id && <div className="pt-depot__dialog-callout">E-posta veya telefon değişikliği o hedefin mevcut izinlerini kapatır. Yeni hedef için ayrıca izin ve kanıt kaydedin.</div>}
            <form onSubmit={(event) => void submitContact(event)} className="pt-depot__form">
              <label>Ad / unvan<input required maxLength={120} value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} autoFocus data-testid="input-contact-name" /></label>
              <label>E-posta <span>İsteğe bağlı</span><input type="email" value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} placeholder="E-posta adresi" data-testid="input-contact-email" /></label>
              <label>Telefon <span>İsteğe bağlı</span><input type="tel" value={contactDraft.phone} onChange={(event) => setContactDraft({ ...contactDraft, phone: event.target.value })} placeholder="05xx xxx xx xx veya +ülke kodu" data-testid="input-contact-phone" /></label>
              {contactDraft.phone && !normalizePhone(contactDraft.phone) && <p className="pt-depot__field-hint">Telefon biçimi geçerli görünmüyor; kaydetmeden önce düzeltin.</p>}
              {!contactDraft.id && <p className="pt-depot__form-note">İzin vermek için kayıt sonrası kanal başına onay kaynağı ve tarih bilgisi girmeniz gerekir.</p>}
              {contactError && <p className="pt-depot__form-error" role="alert">{contactError}</p>}
              {error && <p className="pt-depot__form-error" role="alert">{error}</p>}
              <div className="pt-depot__dialog-actions"><button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setContactDraft(null)} data-testid="button-contact-form-dismiss">Vazgeç</button><button type="submit" className="pt-depot__button pt-depot__button--primary" disabled={busy} data-testid="button-contact-save">{busy ? 'Kaydediliyor' : 'Kişiyi kaydet'}</button></div>
            </form>
          </section>
        </div>
      )}

      {permissionTarget && (
        <div className="pt-depot__scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPermissionTarget(null); }}>
          <section className="pt-depot__dialog pt-depot__dialog--narrow" role="dialog" aria-modal="true" aria-labelledby="permission-dialog-title">
            <div className="pt-depot__dialog-top"><span className="pt-depot__section-kicker">İZİN KAYDI</span><button type="button" className="pt-depot__dialog-close" onClick={() => setPermissionTarget(null)} aria-label="Pencereyi kapat" data-testid="button-permission-dialog-close">×</button></div>
            <h2 id="permission-dialog-title">{permissionTarget.grant ? `${channelLabel(permissionTarget.channel)} izni kaydet` : `${channelLabel(permissionTarget.channel)} iznini kapat`}</h2>
            <p className="pt-depot__dialog-intro"><strong>{permissionTarget.contact.name}</strong> · {permissionTarget.contact.email || permissionTarget.contact.phone || 'İletişim hedefi belirtilmemiş'}</p>
            {permissionTarget.grant ? (
              <>
                <div className="pt-depot__dialog-callout">Açık onay kanıtı olmadan izin vermeyin. İlan sahibi olmak veya manuel kayıt olmak onay sayılmaz.</div>
                <form onSubmit={(event) => void submitPermission(event)} className="pt-depot__form">
                  <label>Onay kaynağı ve tarih <span>Gerekli</span><textarea required minLength={4} rows={4} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Örn. kaydedilmiş açık onay kaynağı ve alındığı tarih" data-testid="input-permission-evidence" /></label>
                  <p className="pt-depot__form-note">Sunucu bu metni izin kanıtı olarak saklar. Yalnızca doğrulanmış onayı kaydedin.</p>
                  {error && <p className="pt-depot__form-error" role="alert">{error}</p>}
                  <div className="pt-depot__dialog-actions"><button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setPermissionTarget(null)} data-testid="button-permission-dismiss">Vazgeç</button><button type="submit" className="pt-depot__button pt-depot__button--primary" disabled={!canSubmitPermission} data-testid="button-permission-confirm">{busy ? 'Kaydediliyor' : 'Kanıtla izin ver'}</button></div>
                </form>
              </>
            ) : (
              <>
                <div className="pt-depot__dialog-callout pt-depot__dialog-callout--warning">İzni kapatmak bu kanaldaki bekleyen mesajları iptal eder. Alıcının tercihine saygı gösterin.</div>
                <form onSubmit={(event) => void submitPermission(event)} className="pt-depot__form">
                  {error && <p className="pt-depot__form-error" role="alert">{error}</p>}
                  <div className="pt-depot__dialog-actions"><button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setPermissionTarget(null)} data-testid="button-permission-dismiss">Vazgeç</button><button type="submit" className="pt-depot__button pt-depot__button--danger" disabled={busy} data-testid="button-permission-confirm">{busy ? 'Kaydediliyor' : 'İzni kapat'}</button></div>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {confirmTarget && (
        <div className="pt-depot__scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmTarget(null); }}>
          <section className="pt-depot__dialog pt-depot__dialog--narrow" role="alertdialog" aria-modal="true" aria-labelledby="archive-dialog-title">
            <span className="pt-depot__section-kicker">{confirmTarget.archived ? 'KAYDI GERİ AL' : 'ARŞİV ONAYI'}</span>
            <h2 id="archive-dialog-title">{confirmTarget.archived ? 'Kişi yeniden aktif olsun mu?' : 'Kişi arşivlensin mi?'}</h2>
            <p className="pt-depot__dialog-intro"><strong>{confirmTarget.contact.name}</strong> için {confirmTarget.archived ? 'kayıt yeniden etkinleşir; daha önce kapatılan izinler açılmaz.' : 'tüm iletişim izinleri kapanır ve bekleyen mesajlar iptal edilir. İlan kayıtları silinmez.'}</p>
            {error && <p className="pt-depot__form-error" role="alert">{error}</p>}
            <div className="pt-depot__dialog-actions"><button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setConfirmTarget(null)} data-testid="button-archive-dismiss">Vazgeç</button><button type="button" className={confirmTarget.archived ? 'pt-depot__button pt-depot__button--primary' : 'pt-depot__button pt-depot__button--danger'} onClick={() => void confirmArchive()} disabled={busy} data-testid="button-archive-confirm">{busy ? 'Kaydediliyor' : confirmTarget.archived ? 'Kaydı geri al' : 'Arşivle ve izinleri kapat'}</button></div>
          </section>
        </div>
      )}

      {campaignOpen && (
        <div className="pt-depot__scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCampaignOpen(false); }}>
          <section className="pt-depot__dialog" role="dialog" aria-modal="true" aria-labelledby="campaign-dialog-title">
            <div className="pt-depot__dialog-top"><span className="pt-depot__section-kicker">BEKLEYEN TASLAK</span><button type="button" className="pt-depot__dialog-close" onClick={() => setCampaignOpen(false)} aria-label="Pencereyi kapat" data-testid="button-campaign-dialog-close">×</button></div>
            <h2 id="campaign-dialog-title">Kampanya oluştur</h2>
            <p className="pt-depot__dialog-intro">Bu işlem yalnızca kampanya kuyruğuna kayıt ekler. Sağlayıcılar bağlanana kadar mesaj gönderilmez.</p>
            <form onSubmit={(event) => void submitCampaign(event)} className="pt-depot__form">
              <label>Kampanya adı<input required maxLength={120} value={campaignDraft.name} onChange={(event) => setCampaignDraft({ ...campaignDraft, name: event.target.value })} data-testid="input-campaign-name" /></label>
              <label>Kanal<select value={campaignDraft.channel} onChange={(event) => setCampaignDraft({ ...campaignDraft, channel: event.target.value as MessageChannel })} data-testid="select-campaign-channel">{CHANNELS.map((channel) => <option value={channel} key={channel}>{channelLabel(channel)} · {channels.find((entry) => entry.channel === channel)?.enabled ? 'sağlayıcı bağlı' : 'sağlayıcı bekleniyor'}</option>)}</select></label>
              {campaignDraft.channel === 'email' && <label>E-posta konusu<input required value={campaignDraft.subject} onChange={(event) => setCampaignDraft({ ...campaignDraft, subject: event.target.value })} data-testid="input-campaign-subject" /></label>}
              <label>Mesaj metni<textarea required rows={5} maxLength={4000} value={campaignDraft.body} onChange={(event) => setCampaignDraft({ ...campaignDraft, body: event.target.value })} data-testid="input-campaign-body" /></label>
              <label>Planlanan tarih ve saat <span>{browserTimezone}</span><input type="datetime-local" required value={campaignDraft.scheduled_at} onChange={(event) => setCampaignDraft({ ...campaignDraft, scheduled_at: event.target.value })} data-testid="input-campaign-schedule" /></label>
              <p className="pt-depot__form-note">Saat, tarayıcınızın yerel saat diliminde yorumlanıp sunucuya ISO 8601 olarak gönderilir. Yalnızca kanal izni verilmiş aktif kişiler uygun alıcıdır.</p>
              {campaignError && <p className="pt-depot__form-error" role="alert">{campaignError}</p>}
              {error && <p className="pt-depot__form-error" role="alert">{error}</p>}
              <div className="pt-depot__dialog-actions"><button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setCampaignOpen(false)} data-testid="button-campaign-dismiss">Vazgeç</button><button type="submit" className="pt-depot__button pt-depot__button--primary" disabled={busy} data-testid="button-campaign-save">{busy ? 'Kaydediliyor' : 'Kuyruğa kaydet'}</button></div>
            </form>
          </section>
        </div>
      )}

      {cancelTarget && (
        <div className="pt-depot__scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelTarget(null); }}>
          <section className="pt-depot__dialog pt-depot__dialog--narrow" role="alertdialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
            <span className="pt-depot__section-kicker">KAMPANYA İŞLEMİ</span>
            <h2 id="cancel-dialog-title">Kampanya iptal edilsin mi?</h2>
            <p className="pt-depot__dialog-intro"><strong>{cancelTarget.name}</strong> iptal edilir. Başlamış gönderimleri geri almak mümkün değildir.</p>
            {error && <p className="pt-depot__form-error" role="alert">{error}</p>}
            <div className="pt-depot__dialog-actions"><button type="button" className="pt-depot__button pt-depot__button--quiet" onClick={() => setCancelTarget(null)} data-testid="button-campaign-cancel-dismiss">Vazgeç</button><button type="button" className="pt-depot__button pt-depot__button--danger" disabled={busy} onClick={async () => { const saved = await cancelCampaign(cancelTarget.id); if (saved) setCancelTarget(null); }} data-testid="button-campaign-cancel-confirm">{busy ? 'İptal ediliyor' : 'Kampanyayı iptal et'}</button></div>
          </section>
        </div>
      )}
    </section>
  );
}