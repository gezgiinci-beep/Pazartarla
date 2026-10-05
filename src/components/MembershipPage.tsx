import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useStoreMembership } from '../hooks/useStoreMembership';
import { planCapacityText, planPriceText, storePlanChoices, type StorePlan, type StoreRequest } from '../lib/storeMembership';
import { membershipAccess } from '../lib/membershipAccess';
import './membership.css';

type Props = {
  state: ReturnType<typeof useStoreMembership>;
  session: any | null;
  onSignIn: () => void;
  onStore: (id: string) => void;
  onSubmitted: () => void;
  initialPlanId?: string;
};

const date = (value?: string) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value))
  : 'Tarih bilgisi yok';

export default function MembershipPage({ state, session, onSignIn, onStore, onSubmitted, initialPlanId }: Props) {
  const requestStorageKey='pt-membership-request-id:'+(session?.user?.id||'anonymous');
  const data = state.data;
  const [planId, setPlanId] = useState(initialPlanId || '');
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [storeRevision, setStoreRevision] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [requestId, setRequestId] = useState(() => {
    try { return window.sessionStorage.getItem(requestStorageKey) || crypto.randomUUID(); }
    catch { return crypto.randomUUID(); }
  });
  const { signedIn, verified } = membershipAccess(session);
  const activeStore = verified ? data?.mine?.store : null;
  const membership = verified ? data?.mine?.membership : null;
  const mineRequests = verified ? data?.mine?.requests ?? [] : [];
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
  const trialUsed = data?.mine?.trial_used === true;
  const trialSelected = selectedPlan?.billing_period === 'trial';

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!verified) { setFormError('Talep göndermek için giriş yapın ve e-posta adresinizi doğrulayın.'); return; }
    if (!selectedPlan) { setFormError('Sunucudan yüklenen paketlerden birini seçin.'); return; }
    if (storeName.trim().length < 2 || storeName.trim().length > 100 || description.length > 500) {
      setFormError('Mağaza adı 2–100 karakter, açıklama en fazla 500 karakter olmalıdır.'); return;
    }
    try { window.sessionStorage.setItem(requestStorageKey, requestId); } catch { /* retry id stays in component state */ }
    if (trialSelected && trialUsed) { setFormError('Bu hesabın ücretsiz deneme hakkı kullanıldı'); return; }
    const ok = await state.action(trialSelected ? 'trial_start' : 'request', requestId, null, {
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
    if (!verified || !activeStore) { setFormError('Mağaza düzenlemek için doğrulanmış hesabınızla giriş yapın.'); return; }
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

      {!signedIn && (
        <section className="pt-member-panel" aria-labelledby="pt-member-signin-title" data-testid="membership-login-required">
          <h2 id="pt-member-signin-title">Mağaza işlemleri için giriş yapın</h2>
          <p className="pt-member-copy">Paketleri ve herkese açık mağazaları inceleyebilirsiniz. Başvuru, mağaza düzenleme ve üyelik bilgileri yalnız hesabınıza giriş yaptıktan sonra açılır.</p>
          <button type="button" className="pt-button pt-button-primary" onClick={onSignIn}>Giriş yap / Üye ol</button>
        </section>
      )}
      {signedIn && !verified && <div className="pt-member-alert" role="alert">Mağaza işlemleri için e-posta adresinizi doğrulayın. Doğrulama tamamlanmadan başvuru ve düzenleme alanları açılmaz.</div>}

      {membership && (
        <section className="pt-member-panel" aria-labelledby="pt-member-current">
          <div className="pt-section-head"><div><p className="pt-member-kicker">ÜYELİK DURUMU</p><h2 id="pt-member-current">{membership.plan_name}</h2></div>
            <span className={`pt-status ${expired ? 'is-muted' : 'is-approved'}`}>{expired ? 'Süresi doldu' : 'Aktif'}</span>
          </div>
          <p className="pt-member-copy">Dönem: <strong>{date(membership.starts_at)} – {date(membership.ends_at)}</strong></p>
          <p className="pt-member-copy">{membership.billing_period === 'trial' ? 'Ücretsiz deneme' : membership.billing_period === 'year' ? 'Yıllık paket' : 'Aylık paket'} kapasitesi: <strong>{planCapacityText(membership)}</strong></p>
          {membership.billing_period === 'trial' && <p className="pt-member-note">Deneme {date(membership.ends_at)} tarihinde sona erer. Otomatik ücretlendirme veya yenileme yoktur.</p>}
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
        {data ? <div className="pt-plan-grid">{storePlanChoices(data.plans).map(({ plan, available }) => {
          const annual = plan.billing_period === 'year';
          const trial = plan.billing_period === 'trial';
          const used = trial && trialUsed;
          const usable = available && !used;
          const sel = usable && planId === plan.id;
          return <button key={plan.id} type="button" disabled={!usable} aria-disabled={!usable} data-testid={plan.id === 'package-3' ? 'plan-package-3' : trial ? 'plan-trial-30-days' : undefined} className={`pt-plan ${sel ? 'is-selected' : ''} ${annual ? 'is-annual' : ''} ${trial ? 'is-trial' : ''} ${!usable ? 'is-unavailable' : ''}`} aria-pressed={sel} onClick={() => usable && setPlanId(plan.id)}>
            {annual && <span className="pt-plan-badge">Yıllık · Sınırsız</span>}
            {trial && <span className="pt-plan-badge">Ücretsiz · 30 gün</span>}
            {trial && <span>Doğrulanmış gönderimden hemen sonra başlar; ödeme gerekmez, otomatik yenileme yoktur. İlanlar yine yönetici onayından geçer.</span>}
            <span className="pt-plan-name">{plan.name}{annual ? ' — Sınırsız' : ''}</span><strong className="pt-plan-price">{planPriceText(plan)}</strong>
            <span>{planCapacityText(plan)}</span>
            {annual && <span>Ödenen yıl boyunca; ilanlar yine yönetici onayından geçer.</span>}
            {used ? <span className="pt-plan-wait" data-testid="trial-already-used">Bu hesabın ücretsiz deneme hakkı kullanıldı</span>
              : available ? <span className="pt-plan-select">{sel ? 'Seçildi' : 'Paketi seç'}</span>
              : <span className="pt-plan-wait" data-testid={trial ? 'trial-plan-setup-required' : 'annual-plan-setup-required'}>{trial ? 'Kurulum bekleniyor' : 'Yönetici kurulumu bekleniyor'}</span>}
          </button>;
        })}</div> : null}
         <p className="pt-member-note">Aylık ilan kotası, üyelik döneminde eklenen yeni ilanları sayar. Listeleme kotası, aynı anda yayındaki ilan kapasitesidir. Onay bekleyen ilanlar bu kapasitede yer ayırır; iki kota birbirinden ayrıdır. Sınırsız paket, ödenen yıl boyunca sınırsız yeni gönderim ve aktif ilan demektir; yönetici yetkisi vermez, moderasyonu atlamaz. İlanlar normal sekiz aylık yayın süresiyle yayında kalır. Ücretli üyelerde günlük 3 ilan sınırı uygulanmaz; yönetici onayı devam eder.</p>
      </section>

      {verified && (!activeStore || expired) && (
        <section className="pt-member-panel" aria-labelledby="pt-request-title">
          <div className="pt-section-head"><div><p className="pt-member-kicker">BAŞVURU</p><h2 id="pt-request-title">{membership && expired ? 'Yeni dönem talebi' : 'Mağaza başvurusu'}</h2></div></div>
          {!canRequestMembership && <div className="pt-member-note">Üyeliğiniz dönem sonuna kadar aktif. Yenileme talebini dönem sona erdiğinde gönderebilirsiniz.</div>}
          {pending && <div className="pt-member-note">Bekleyen bir talebiniz var. Yönetici incelemesi tamamlanana kadar yeni talep gönderemezsiniz.</div>}
          <form className="pt-member-form" onSubmit={submitRequest}>
            {!selectedPlan && <div className="pt-member-alert" role="status">Başvurmadan önce yukarıdaki paketlerden birini seçin. Kartta “Seçildi” yazmalıdır.</div>}
             <label>Mağaza adı<input value={storeName} maxLength={100} minLength={2} required onChange={e => {dirty.current=true;setStoreName(e.target.value);}} placeholder="Örn. Akpınar Çiftliği" /></label>
             <label>Mağaza tanıtımı <span className="pt-optional">İsteğe bağlı</span><textarea value={description} maxLength={500} rows={4} onChange={e => {dirty.current=true;setDescription(e.target.value);}} placeholder="Ürünlerinizi ve üretim yerinizi kısaca anlatın." /><small>{description.length}/500</small></label>
            {trialSelected && trialUsed && <div className="pt-member-alert" role="status">Bu hesabın ücretsiz deneme hakkı kullanıldı</div>}
            {formError && <div className="pt-member-alert" role="alert">{formError}</div>}
            <button className="pt-button pt-button-primary" type="submit" disabled={(trialSelected && trialUsed) || !selectedPlan || !session || !verified || !canRequestMembership || pending || state.busy || state.loading || !data?.plans.length}>
              {state.busy ? (trialSelected ? 'Deneme başlatılıyor…' : 'Talep gönderiliyor…') : trialSelected ? '30 günlük denemeyi başlat' : 'Üyelik talebi gönder'}
            </button>
            {trialSelected ? <p className="pt-member-fine">Doğrulanmış hesabınızla gönderdiğinizde deneme hemen başlar; yönetici onayı beklenmez ve ödeme gerekmez. 30 gün sonra sona erer, otomatik ücretlendirme yoktur.</p>
              : <p className="pt-member-fine">Ödeme banka havalesiyle yapılır. Talep, ödemenin yönetici tarafından gerçekten doğrulanıp onaylanmasına kadar üyeliği etkinleştirmez. Otomatik yenileme yoktur.</p>}
          </form>
        </section>
      )}

      {mineRequests.length > 0 && <section className="pt-member-section" aria-labelledby="pt-history-title">
        <p className="pt-member-kicker">TALEP GEÇMİŞİ</p><h2 id="pt-history-title">Başvurularınız</h2>
        <div className="pt-request-list">{mineRequests.map((request: StoreRequest) => <article className="pt-request-row" key={request.id}>
          <div><strong>{request.store_name}</strong><span>{request.plan_name} · {planPriceText(request)} · {planCapacityText(request)} · {date(request.created_at)}</span></div>
          <span className={`pt-status is-${request.status}`}>{request.billing_period === 'trial' ? 'Deneme başladı' : request.status === 'pending' ? 'İncelemede' : request.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}</span>
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