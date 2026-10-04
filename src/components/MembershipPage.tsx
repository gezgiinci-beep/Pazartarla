import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useStoreMembership } from '../hooks/useStoreMembership';
import type { StorePlan, StoreRequest } from '../lib/storeMembership';
import './membership.css';

type Props = {
  state: ReturnType<typeof useStoreMembership>;
  session: any | null;
  onSignIn: () => void;
  onStore: (id: string) => void;
  onSubmitted: () => void;
};

const money = (amount: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(amount);
const date = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value))
  : 'Tarih bilgisi yok';
const confirmed = (session: any | null) => Boolean(session?.user?.email_confirmed_at);

export default function MembershipPage({ state, session, onSignIn, onStore, onSubmitted }: Props) {
  const requestStorageKey='pt-membership-request-id:'+(session?.user?.id||'anonymous');
  const data = state.data;
  const [planId, setPlanId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [storeRevision, setStoreRevision] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [requestId, setRequestId] = useState(() => {
    try { return window.sessionStorage.getItem(requestStorageKey) || crypto.randomUUID(); }
    catch { return crypto.randomUUID(); }
  });
  const activeStore = data?.mine?.store;
  const membership = data?.mine?.membership;
  const mineRequests = data?.mine?.requests ?? [];
  const pending = mineRequests.some((request: StoreRequest) => request.status === 'pending');
  const expired = membership ? Date.parse(membership.ends_at) <= Date.now() : false;
  const canRequestMembership = !membership || expired;
  const dirty = useRef(false);

  useEffect(() => {
    if (activeStore && !dirty.current) {
      setStoreName(activeStore.name);
      setDescription(activeStore.description);
      setStoreRevision(activeStore.revision);
    }
  }, [activeStore]);

  const availablePlans = useMemo(() => data?.plans ?? [], [data?.plans]);
  const selectedPlan = availablePlans.find((plan: StorePlan) => plan.id === planId);
  const verified = confirmed(session);

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!session || !verified) { setFormError('Talep göndermek için giriş yapın ve e-posta adresinizi doğrulayın.'); return; }
    if (!selectedPlan) { setFormError('Sunucudan yüklenen paketlerden birini seçin.'); return; }
    if (storeName.trim().length < 2 || storeName.trim().length > 100 || description.length > 500) {
      setFormError('Mağaza adı 2–100 karakter, açıklama en fazla 500 karakter olmalıdır.'); return;
    }
    try { window.sessionStorage.setItem(requestStorageKey, requestId); } catch { /* retry id stays in component state */ }
    const ok = await state.action('request', requestId, null, {
      plan_id: selectedPlan.id, store_name: storeName.trim(), description: description.trim(),
    });
    if (ok) {
      try { window.sessionStorage.removeItem(requestStorageKey); } catch { /* optional persistence */ }
      setRequestId(crypto.randomUUID());
      dirty.current = false;
      onSubmitted();
    }
  };

  const saveStore = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (storeName.trim().length < 2 || storeName.trim().length > 100 || description.length > 500) {
      setFormError('Mağaza adı 2–100 karakter, açıklama en fazla 500 karakter olmalıdır.'); return;
    }
    if (storeRevision === null) {
      setFormError('Mağaza sürümü yüklenemedi. Yenileyip tekrar deneyin.');
      return;
    }
    const ok = await state.action('store', null, storeRevision, { store_name: storeName.trim(), description: description.trim() });
    if (ok) {
      dirty.current = false;
      await state.refresh();
    }
  };

  return (
    <main className="pt-membership">
      <header className="pt-member-hero">
        <p className="pt-member-kicker">PAZARTARLA · ÜRETİCİ MAĞAZALARI</p>
        <h1>Kendi mağazanız,<br />ürününüzün yanında.</h1>
        <p>Doğrulanmış üyelerin mağazaları ve ilanları, yönetici incelemesinden sonra PazarTarla’da yer alır.</p>
      </header>

      {(state.error || state.actionError) && <div className="pt-member-alert" role="alert">{state.actionError || state.error}</div>}
      {state.message && <div className="pt-member-success" role="status">{state.message}</div>}

      {state.loading && !data ? <div className="pt-member-loading" role="status"><span /> Üyelik bilgileri yükleniyor…</div> : null}
      {!state.loading && state.error && <button className="pt-button pt-button-secondary" type="button" onClick={() => void state.refresh()}>Yeniden yükle</button>}

      {membership && (
        <section className="pt-member-panel" aria-labelledby="pt-member-current">
          <div className="pt-section-head"><div><p className="pt-member-kicker">ÜYELİK DURUMU</p><h2 id="pt-member-current">{membership.plan_name}</h2></div>
            <span className={`pt-status ${expired ? 'is-muted' : 'is-approved'}`}>{expired ? 'Süresi doldu' : 'Aktif'}</span>
          </div>
          <p className="pt-member-copy">Dönem: <strong>{date(membership.starts_at)} – {date(membership.ends_at)}</strong></p>
          <p className="pt-member-copy">Aylık ilan gönderim sınırı: <strong>{membership.monthly_limit}</strong> · Eşzamanlı aktif ilan kapasitesi: <strong>{membership.active_limit}</strong></p>
          {!expired && <p className="pt-member-note">Yenileme talebi yalnızca mevcut dönem sona erdiğinde gönderilebilir.</p>}
        </section>
      )}

      {activeStore && (
        <section className="pt-member-panel" aria-labelledby="pt-store-edit-title">
          <div className="pt-section-head"><div><p className="pt-member-kicker">MAĞAZA KİMLİĞİ</p><h2 id="pt-store-edit-title">Mağazanızı düzenleyin</h2></div>
            <button type="button" className="pt-text-button" onClick={() => onStore(activeStore.id)}>Mağazayı görüntüle</button>
          </div>
          <form className="pt-member-form" onSubmit={saveStore}>
            <label>Mağaza adı<input value={storeName} maxLength={100} minLength={2} required onChange={e => { dirty.current = true; setStoreName(e.target.value); }} /></label>
            <label>Kısa tanıtım<textarea value={description} maxLength={500} rows={4} onChange={e => { dirty.current = true; setDescription(e.target.value); }} /><small>{description.length}/500</small></label>
             <button className="pt-button pt-button-primary" type="submit" disabled={state.busy||expired}>{state.busy ? 'Kaydediliyor…' : 'Mağaza bilgilerini kaydet'}</button>
             <button className="pt-button pt-button-secondary" type="button" disabled={state.busy} onClick={()=>{
               if(dirty.current&&!window.confirm('Kaydedilmemiş mağaza taslağını bırakıp sunucudaki güncel bilgileri yüklemek istiyor musunuz?'))return;
               setStoreName(activeStore.name);setDescription(activeStore.description);setStoreRevision(activeStore.revision);dirty.current=false;setFormError('');
             }}>Sunucudaki güncel bilgileri kullan</button>
          </form>
          <StoreUrl id={activeStore.id} />
        </section>
      )}

      <section className="pt-member-section" aria-labelledby="pt-plans-title">
        <div className="pt-section-head"><div><p className="pt-member-kicker">PAKETLER</p><h2 id="pt-plans-title">İhtiyacınıza uygun kapasite</h2></div></div>
        {data && data.plans.length === 0 && <div className="pt-member-empty">Paket bilgisi şu anda sunucuda bulunmuyor. Lütfen daha sonra yeniden deneyin.</div>}
        {data?.plans.length ? <div className="pt-plan-grid">{data.plans.map((plan: StorePlan) => (
          <button key={plan.id} type="button" className={`pt-plan ${planId === plan.id ? 'is-selected' : ''}`} aria-pressed={planId === plan.id} onClick={() => setPlanId(plan.id)}>
            <span className="pt-plan-name">{plan.name}</span><strong className="pt-plan-price">{money(plan.monthly_price_try)} <small>TL / ay</small></strong>
            <span>{plan.monthly_limit} gönderim / ay</span><span>{plan.active_limit} eşzamanlı aktif ilan</span>
            <span className="pt-plan-select">{planId === plan.id ? 'Seçildi' : 'Paketi seç'}</span>
          </button>
        ))}</div> : null}
         <p className="pt-member-note">Aylık ilan kotası, üyelik döneminde eklenen yeni ilanları sayar. Listeleme kotası, aynı anda yayındaki ilan kapasitesidir. Onay bekleyen ilanlar bu kapasitede yer ayırır; iki kota birbirinden ayrıdır. Ücretli üyelerde günlük 3 ilan sınırı uygulanmaz; yönetici onayı devam eder.</p>
      </section>

      {(!activeStore || expired) && (
        <section className="pt-member-panel" aria-labelledby="pt-request-title">
          <div className="pt-section-head"><div><p className="pt-member-kicker">BAŞVURU</p><h2 id="pt-request-title">{membership && expired ? 'Yeni dönem talebi' : 'Mağaza başvurusu'}</h2></div></div>
          {session && !verified && <div className="pt-member-alert">Başvuru için giriş yapılmış ve e-posta adresi doğrulanmış hesap gerekir.</div>}
          {!session && <div className="pt-member-callout"><span>Başvuru için hesabınıza giriş yapın.</span><button type="button" className="pt-button pt-button-secondary" onClick={onSignIn}>Giriş yap</button></div>}
          {!canRequestMembership && <div className="pt-member-note">Üyeliğiniz dönem sonuna kadar aktif. Yenileme talebini dönem sona erdiğinde gönderebilirsiniz.</div>}
          {pending && <div className="pt-member-note">Bekleyen bir talebiniz var. Yönetici incelemesi tamamlanana kadar yeni talep gönderemezsiniz.</div>}
          <form className="pt-member-form" onSubmit={submitRequest}>
             <label>Mağaza adı<input value={storeName} maxLength={100} minLength={2} required onChange={e => {dirty.current=true;setStoreName(e.target.value);}} placeholder="Örn. Akpınar Çiftliği" /></label>
             <label>Mağaza tanıtımı <span className="pt-optional">İsteğe bağlı</span><textarea value={description} maxLength={500} rows={4} onChange={e => {dirty.current=true;setDescription(e.target.value);}} placeholder="Ürünlerinizi ve üretim yerinizi kısaca anlatın." /><small>{description.length}/500</small></label>
            {formError && <div className="pt-member-alert" role="alert">{formError}</div>}
            <button className="pt-button pt-button-primary" type="submit" disabled={!selectedPlan || !session || !verified || !canRequestMembership || pending || state.busy || state.loading || !data?.plans.length}>
              {state.busy ? 'Talep gönderiliyor…' : 'Üyelik talebi gönder'}
            </button>
            <p className="pt-member-fine">Ödeme banka havalesiyle yapılır. Talep, ödemenin yönetici tarafından gerçekten doğrulanıp onaylanmasına kadar üyeliği etkinleştirmez. Otomatik yenileme yoktur.</p>
          </form>
        </section>
      )}

      {mineRequests.length > 0 && <section className="pt-member-section" aria-labelledby="pt-history-title">
        <p className="pt-member-kicker">TALEP GEÇMİŞİ</p><h2 id="pt-history-title">Başvurularınız</h2>
        <div className="pt-request-list">{mineRequests.map((request: StoreRequest) => <article className="pt-request-row" key={request.id}>
          <div><strong>{request.store_name}</strong><span>{request.plan_name} · {date(request.created_at)}</span></div>
          <span className={`pt-status is-${request.status}`}>{request.status === 'pending' ? 'İncelemede' : request.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}</span>
        </article>)}</div>
      </section>}

      <section className="pt-member-section" aria-labelledby="pt-stores-title">
        <div className="pt-section-head"><div><p className="pt-member-kicker">ÜRETİCİLERDEN</p><h2 id="pt-stores-title">Aktif mağazalar</h2></div></div>
        {state.loading && !data ? <div className="pt-member-loading" role="status"><span /> Mağazalar yükleniyor…</div> :
          data?.stores.length ? <div className="pt-public-stores">{data.stores.map(store => <button className="pt-public-store" key={store.id} type="button" onClick={() => onStore(store.id)}>
            <span className="pt-store-mark">{store.name.trim().slice(0, 1).toLocaleUpperCase('tr-TR')}</span><span><strong>{store.name}</strong><small>{store.listing_ids.length} ilan</small></span><span className="pt-store-arrow">Görüntüle</span>
          </button>)}</div> : <div className="pt-member-empty">Henüz yayındaki bir mağaza yok.</div>}
      </section>
    </main>
  );
}

function StoreUrl({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?magaza=${encodeURIComponent(id)}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return <div className="pt-share-url"><div><small>Mağaza bağlantınız</small><code>{url}</code></div><button type="button" className="pt-button pt-button-secondary" onClick={() => void copy()} disabled={!url}>{copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}</button></div>;
}