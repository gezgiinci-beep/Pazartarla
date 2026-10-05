import './membership.css';
import {planCapacityText,planPriceText,storePlanChoices,type StorePlan} from '../lib/storeMembership';

type Props = { onOpen: () => void; compact?: boolean;plans?:StorePlan[] };

export default function MembershipNotice({ onOpen, compact = false,plans=[] }: Props) {
  const choices=storePlanChoices(plans);
  const annual=choices.find(({plan})=>plan.id==='package-3')!;
  return <aside data-testid="notice-package-3" className={`pt-membership-notice ${compact ? 'is-compact' : ''}`}>
    <div className="pt-notice-label">PAZARTARLA MAĞAZA ÜYELİĞİ</div>
    {compact ? <>
      <strong>Günlük 3 ilan sınırına mı ulaştınız?</strong>
       <p>Ücretli üyelikte günlük sınır yerine paket kotaları uygulanır; Paket 3 — Sınırsız: {planPriceText(annual.plan)}. Kendi mini mağazanız da açılır.</p>
       {!annual.available&&<p className="pt-notice-foot">Paket 3 için yönetici kurulumu bekleniyor.</p>}
    </> : <>
      <h2>Üretiminize ait bir mağaza açın.</h2>
      <p>Ücretli üyelikte normal kullanıcıların günlük 3 ilan sınırı uygulanmaz. Yıllık Sınırsız paket, ödenen yıl boyunca sınırsız ilan sunar; moderasyon sürer.</p>
       <div className="pt-notice-prices">{choices.map(({plan,available})=><span key={plan.id} className={plan.id==='package-3'?'pt-notice-annual':plan.billing_period==='trial'?'pt-notice-trial':undefined}>
         {plan.id==='package-3'&&<b>Paket 3 — Sınırsız</b>}{plan.billing_period==='trial'&&<b>Deneme</b>}<b>{planPriceText(plan)}</b><small>{planCapacityText(plan)}</small>
         {!available&&<small>Yönetici kurulumu bekleniyor.</small>}
       </span>)}</div>
    </>}
    <p className="pt-notice-foot">Ücretli paketlerde banka havalesi manuel incelenir; 30 günlük deneme ödemesizdir. Ödeme doğrulanıp yönetici onayı verilmeden üyelik açılmaz; otomatik yenileme yoktur.</p>
    <button className="pt-button pt-button-primary" type="button" onClick={onOpen}>{compact ? 'Paketleri incele' : 'Mağaza üyeliğini incele'}</button>
  </aside>;
}