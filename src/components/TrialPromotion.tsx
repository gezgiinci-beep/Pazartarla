import './trial-promotion.css';

type Props = { onOpenTrial: () => void; ready: boolean; used: boolean };

export default function TrialPromotion({ onOpenTrial, ready, used }: Props) {
  return <section className="pt-trial" data-testid="trial-promotion" aria-labelledby="pt-trial-title">
    <svg className="pt-trial-art" viewBox="0 0 160 120" role="img" aria-label="Toprakta filizlenen fidan ve otuz günü gösteren takvim çizgileri">
      <circle className="pt-trial-sun" cx="118" cy="34" r="20" />
      <path d="M0 96 Q40 84 80 94 T160 90 V120 H0Z" fill="#557653" opacity=".35" />
      <path d="M0 108 Q50 98 100 106 T160 104 V120 H0Z" fill="#244735" />
      <g className="pt-trial-sprout">
        <path d="M60 104 V62" stroke="#244735" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M60 74 C44 74 38 62 40 52 C54 52 60 62 60 74Z" fill="#557653" />
        <path d="M60 64 C74 64 82 52 78 42 C64 42 58 52 60 64Z" fill="#b89d5b" />
      </g>
      <g stroke="#244735" strokeWidth="1" opacity=".4">
        {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${96 + i * 10} 60 V70`} />)}
      </g>
    </svg>
    <div className="pt-trial-body">
      <p className="pt-trial-kicker">MAĞAZA · DÖRDÜNCÜ SEÇENEK</p>
      <h2 id="pt-trial-title">30 Gün Ücretsiz Deneme</h2>
      <p className="pt-trial-copy">Doğrulanmış hesabınızla mağaza denemenizi gönderdiğiniz anda başlar. Otuz gün boyunca sınırsız yeni ilan gönderin, aynı anda sınırsız ilan yayında tutun.</p>
      <ul className="pt-trial-list">
        <li>Ödeme ve kart bilgisi istenmez</li>
        <li>Otomatik ücretli yenileme yoktur</li>
        <li>Hesap başına bir kez; ilan moderasyonu ve sekiz aylık yayın süresi sürer</li>
      </ul>
      {used ? <p className="pt-trial-state" data-testid="trial-already-used">Bu hesabın ücretsiz deneme hakkı kullanıldı. Ücretli paketleri inceleyebilirsiniz.</p>
        : !ready ? <p className="pt-trial-state" data-testid="trial-plan-setup-required">Kurulum bekleniyor: deneme paketi henüz sunucuda etkin değil.</p> : null}
      <button type="button" className="pt-trial-cta" data-testid="trial-promotion-cta" onClick={onOpenTrial}>
        {used ? 'Paketleri incele' : ready ? 'Denemeyi seç' : 'Paketleri incele'}
      </button>
    </div>
  </section>;
}
