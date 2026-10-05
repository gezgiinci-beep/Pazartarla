import { useState, type FormEvent } from 'react';
import { planCapacityText, planPriceText, type StoreRequest } from '../lib/storeMembership';
import { useStoreMembership } from '../hooks/useStoreMembership';
import { membershipAccess } from '../lib/membershipAccess';
import './membership.css';

type Props = { state: ReturnType<typeof useStoreMembership>; session: any | null; authorized: boolean; onBack: () => void };
const date = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function MembershipAdmin({ state, session, authorized, onBack }: Props) {
  const [references, setReferences] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<StoreRequest | null>(null);
  const canManage = authorized && membershipAccess(session).verified;
  const requests = state.data?.requests ?? [];
  const pending = requests.filter(row => row.status === 'pending');
  const processed = requests.filter(row => row.status !== 'pending');
  const approve = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !confirming) return;
    const reference = (references[confirming.id] || '').trim();
    if (reference.length < 6 || reference.length > 120) return;
    const ok = await state.action('approve', confirming.id, confirming.revision, { payment_confirmed: true, payment_reference: reference });
    if (ok) { setReferences(current => { const next = { ...current }; delete next[confirming.id]; return next; }); setConfirming(null); }
  };
  const reject = async (request: StoreRequest) => {
    if (!canManage) return;
    if (!window.confirm(`${request.store_name} mağaza talebini reddetmek istiyor musunuz?`)) return;
    await state.action('reject', request.id, request.revision, {});
  };
  const retry = () => { void state.refresh(); };
  if (!canManage) return <main className="pt-membership" data-testid="membership-admin-login-required">
    <p className="pt-member-alert" role="alert">Mağaza ödeme ve başvuru yönetimi için yönetici hesabıyla giriş yapın.</p>
    <button type="button" className="pt-button pt-button-secondary" onClick={onBack}>Giriş ekranına dön</button>
  </main>;
  return <main className="pt-membership pt-admin">
    <button className="pt-text-button pt-back" type="button" onClick={onBack}>← Panele dön</button>
    <header className="pt-admin-heading"><p className="pt-member-kicker">YÖNETİCİ · MAĞAZA ÜYELİKLERİ</p><h1>Ödeme ve başvuru incelemesi</h1><p>Ödemeyi bankada gerçekten doğrulamadan üyeliği onaylamayın.</p></header>
    {state.error && <div className="pt-member-alert" role="alert"><span>{state.error}</span><button className="pt-button pt-button-secondary" type="button" onClick={retry} disabled={state.loading}>Yeniden yükle</button></div>}
    {state.actionError && <div className="pt-member-alert" role="alert">İşlem sonucu doğrulanamadı: {state.actionError}<button className="pt-button pt-button-secondary" type="button" onClick={retry}>Listeyi yenile</button></div>}
    {state.message && !state.actionError && <div className="pt-member-success" role="status">{state.message} Liste ayrıca yenileniyor; mesaj işlem sonucudur, yenileme hatası ayrı gösterilir.</div>}
    {state.loading && !state.data && <div className="pt-member-loading" role="status"><span /> Talepler yükleniyor…</div>}
    <section className="pt-member-section"><div className="pt-section-head"><div><p className="pt-member-kicker">İŞLEM BEKLİYOR</p><h2>Bekleyen talepler <span className="pt-count">{pending.length}</span></h2></div><button className="pt-button pt-button-secondary" type="button" onClick={retry} disabled={state.loading || state.busy}>{state.loading ? 'Yenileniyor…' : 'Listeyi yenile'}</button></div>
      {pending.length ? <div className="pt-admin-requests">{pending.map(request => <article className="pt-admin-request" key={request.id}>
        <div className="pt-admin-request-head"><div><span className="pt-status is-pending">İncelemede</span><h3>{request.store_name}</h3></div><time>{date(request.created_at)}</time></div>
        <div className="pt-admin-details"><span><small>Başvuru e-postası</small><strong>{request.email || 'Sunucu bilgisi yok'}</strong></span><span><small>Paket</small><strong>{request.plan_name}</strong></span><span><small>Ücret</small><strong>{planPriceText(request)}</strong></span><span><small>Kapasite</small><strong>{planCapacityText(request)}</strong></span></div>
        <label className="pt-admin-reference">Doğrulanmış ödeme işlem referansı
          <input value={references[request.id] ?? ''} minLength={6} maxLength={120} placeholder="Yalnızca işlem referansı" onChange={e => setReferences(current => ({ ...current, [request.id]: e.target.value }))} />
          <small>6–120 karakter. Hesap veya kart numarası girmeyin.</small>
        </label>
        <div className="pt-admin-actions"><button className="pt-button pt-button-primary" type="button" disabled={state.busy || (references[request.id] || '').trim().length < 6 || (references[request.id] || '').trim().length > 120} onClick={() => setConfirming(request)}>Ödemeyi doğrula ve onayla</button><button className="pt-button pt-button-danger" type="button" disabled={state.busy} onClick={() => void reject(request)}>Talebi reddet</button></div>
      </article>)}</div> : !state.loading && <div className="pt-member-empty">Bekleyen üyelik talebi yok.</div>}
    </section>
    <section className="pt-member-section"><p className="pt-member-kicker">GEÇMİŞ</p><h2>İşlenmiş talepler</h2>{processed.length ? <div className="pt-request-list">{processed.map(row => <article className="pt-request-row" key={row.id}><div><strong>{row.store_name}</strong><span>{row.email || 'E-posta sunucudan paylaşılmadı'} · {row.plan_name} · {planPriceText(row)} · {date(row.created_at)}</span></div><span className={`pt-status is-${row.status}`}>{row.billing_period === 'trial' ? 'Deneme başladı' : row.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}</span></article>)}</div> : <div className="pt-member-empty">İşlenmiş talep bulunmuyor.</div>}</section>
    {confirming && <div className="pt-modal-scrim" role="presentation"><section className="pt-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="pt-confirm-title">
      <p className="pt-member-kicker">ÖDEME ONAYI</p><h2 id="pt-confirm-title">{confirming.store_name} için üyeliği aç?</h2><p>Yalnızca gerçek banka transferini doğruladıysanız devam edin. İşlem referansı {references[confirming.id]?.trim()}.</p>
      <form onSubmit={approve}><div className="pt-admin-actions"><button className="pt-button pt-button-primary" type="submit" disabled={state.busy || (references[confirming.id] || '').trim().length < 6 || (references[confirming.id] || '').trim().length > 120}>{state.busy ? 'Kaydediliyor…' : 'Doğrulamayı onayla'}</button><button className="pt-button pt-button-secondary" type="button" disabled={state.busy} onClick={() => setConfirming(null)}>Vazgeç</button></div></form>
    </section></div>}
  </main>;
}