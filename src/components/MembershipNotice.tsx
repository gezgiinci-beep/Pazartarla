import './membership.css';
import type {StorePlan} from '../lib/storeMembership';

type Props = { onOpen: () => void; compact?: boolean;plans?:StorePlan[] };

export default function MembershipNotice({ onOpen, compact = false,plans=[] }: Props) {
  return <aside className={`pt-membership-notice ${compact ? 'is-compact' : ''}`}>
    <div className="pt-notice-label">PAZARTARLA MAĞAZA ÜYELİĞİ</div>
    {compact ? <>
      <strong>Günlük 3 ilan sınırına mı ulaştınız?</strong>
       <p>Ücretli üyelikte günlük sınır yerine aylık gönderim ve eşzamanlı aktif ilan kotaları uygulanır. Kendi mini mağazanız da açılır.</p>
    </> : <>
      <h2>Üretiminize ait bir mağaza açın.</h2>
      <p>Ücretli üyelikte normal kullanıcıların günlük 3 ilan sınırı uygulanmaz. Yönetici incelemesi tüm ilanlarda sürer.</p>
       <div className="pt-notice-prices">{plans.map(plan=><span key={plan.id}><b>{plan.monthly_price_try} TL / ay</b><small>{plan.monthly_limit} gönderim · {plan.active_limit} aktif ilan</small></span>)}</div>
    </>}
    <p className="pt-notice-foot">Banka havalesi manuel incelenir. Ödeme doğrulanıp yönetici onayı verilmeden üyelik açılmaz; otomatik yenileme yoktur.</p>
    <button className="pt-button pt-button-primary" type="button" onClick={onOpen}>{compact ? 'Paketleri incele' : 'Mağaza üyeliğini incele'}</button>
  </aside>;
}