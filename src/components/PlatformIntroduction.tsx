import './platform-introduction.css';

const benefits: [string, string][] = [
  ['Sıfır Teknik Yük, Maksimum Verim', 'Kodlama bilmenize, sunucu kiralamanıza veya tasarımcı peşinde koşmanıza gerek kalmadan dakikalar içinde kendi dükkanınızı kurun.'],
  ['Yüksek Maliyetlere Son', 'Piyasadaki devasa e-ticaret bütçelerini unutun. Sadece yılda 2.500 TL gibi inanılmaz ekonomik bir yatırımla tüm yıl boyunca kesintisiz satış yapın.'],
  ['Doğrudan Müşteri Ağı', 'Aracıları ortadan kaldırın; mahsulünüzü, makinelerinizi ve ticari mallarınızı doğrudan alıcısıyla buluşturun, kazancınız cebinizde kalsın.'],
  ['Geniş Altyapı ve Güçlü Destek', 'Arkanızda duran sağlam teknolojik altyapı ve her adımda yanınızda olan profesyonel destek ekibiyle asla yalnız kalmayın.'],
];

export default function PlatformIntroduction() {
  return (
    <details className="pt-intro" data-testid="platform-introduction">
      <summary className="pt-intro__summary" data-testid="platform-introduction-toggle">
        <span>PazarTarla’yı Tanıyın</span>
        <span className="pt-intro__chev" aria-hidden="true" />
      </summary>
      <article className="pt-intro__body">
        <h2>Aradığınız O Büyük Fırsat Nihayet Karşınızda: PazarTarla.com.tr ile Dijitalde Kendi İmparatorluğunuzu Kurun!</h2>
        <p>Günlerce, aylarca süren yazılım krizleri, binlerce liralık bütçeler, karmaşık sunucu ayarları, güvenlik duvarları ve teknik detaylar... Tarım sektöründe emeğinizi, ürünlerinizi ve mahsullerinizi dijital dünyaya taşımak isterken karşılaştığınız bu bitmek bilmeyen engellerden sıkılmadınız mı? Artık durun ve derin bir nefes alın. Çünkü tam da aradığınız, "İşte budur!" dedirtecek o kusursuz çözüm karşınızda duruyor.</p>
        <h3>Modern Tarımın ve Ticaretin Dijital Üssü</h3>
        <p>Binlerce lira harcamaya, teknik uzmanların kapısında günlerce beklemeye ya da kafanızı karmaşık kodlarla bozmaya gerek yok. Sadece tarımsal faaliyetlerinizle, mahsullerinizle ve ticaretinizle ilgilenin; gerisini PazarTarla.com.tr'nin kusursuz altyapısına bırakın. Bu platform; üreticinin, çiftçinin, kooperatiflerin ve tarım makineleri tedarikçilerinin sesini doğrudan milyonlarca potansiyel alıcıya ulaştırmak için tasarlandı.</p>
        <p>Yıllardır süregelen geleneksel pazarlama yöntemleri, mahsulün tarlada değerini bulamaması veya aracıların kazancınıza ortak olması kaderiniz değil. Kendi iş yerinizi, kendi dijital mağazanızı tamamen bağımsız bir şekilde bu çatı altında açabilir; ürünlerinizi en net görseller ve en güçlü açıklamalarla doğrudan tüketicinin beğenisine sunabilirsiniz.</p>
        <h3>Neden PazarTarla.com.tr?</h3>
        <ul className="pt-intro__benefits">
          {benefits.map(([t, d]) => (
            <li key={t}><strong>{t}:</strong> {d}</li>
          ))}
        </ul>
        <h3>Emeğinizin Değerini Dijitalde Katlayın</h3>
        <p>Bir tarım işletmesinin veya üreticinin en değerli varlığı zamanı ve emeğidir. Tarlada dökülen her damla alın terinin karşılığını dijital dünyada eksiksiz almanız gerekiyor. PazarTarla.com.tr, sadece bir ilan sitesi değil; üreticinin gururla ayağa kalktığı, ticari mallarını hak ettiği değerden sergilediği bir inovasyon merkezidir.</p>
        <p>Bugün atacağınız bu küçük adım, yarın milyonlarca müşteriye açılan devasa bir kapının anahtarı olacak. Koltuğunuzdan kalkmadan, zahmetsizce ve bütçenizi sarsmadan kendi dijital mağazanızı kurmanın şimdi tam zamanı.</p>
        <p>Gelin, bu yolda el ele verelim; tarımın gücünü dijitalin imkanlarıyla birleştirip geleceği birlikte inşa edelim. PazarTarla.com.tr'de yerinizi alın, bu eşsiz fırsatla kazanan siz olun!</p>
      </article>
    </details>
  );
}
