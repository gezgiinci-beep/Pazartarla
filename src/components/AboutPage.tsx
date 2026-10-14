import { useEffect } from 'react';
import './about-page.css';

type Props = { onBack: () => void; onPackages: () => void; annualReady: boolean };

const TITLE = 'Aradığınız O Büyük Fırsat Nihayet Karşınızda: PazarTarla.com.tr ile Dijitalde Kendi İmparatorluğunuzu Kurun!';

export function AboutNotice({ onRead }: { onRead: () => void }) {
  return <aside data-testid="about-notice" className="pt-about-notice" aria-label="Hakkımızda duyurusu">
    <strong>{TITLE}</strong>
    <button type="button" onClick={onRead}>Hakkımızda / Devamını oku</button>
  </aside>;
}

export default function AboutPage({ onBack, onPackages, annualReady }: Props) {
  useEffect(() => {
    const title = document.title;
    document.title = 'Hakkımızda | PazarTarla';
    const description = document.querySelector('meta[name="description"]');
    const previous = description?.getAttribute('content');
    description?.setAttribute('content', 'PazarTarla: üreticileri, çiftçileri ve tarım işletmelerini alıcılarla buluşturan dijital pazar.');
    return () => {
      document.title = title;
      if (description && previous !== null && previous !== undefined) description.setAttribute('content', previous);
    };
  }, []);
  return <section className="pt-about" data-testid="about-page" aria-labelledby="about-title">
    <button className="pt-about-back" type="button" onClick={onBack} data-testid="button-about-back">Geri dön</button>
    {!annualReady && <div className="pt-about-pending" role="status" data-testid="about-annual-pending"><p>Yıllık üyelik kurulumu henüz tamamlanmadı.</p></div>}
    <article className="pt-about-article">
      <h1 id="about-title">{TITLE}</h1>
      <p>Günlerce, aylarca süren yazılım krizleri, binlerce liralık bütçeler, karmaşık sunucu ayarları, güvenlik duvarları ve teknik detaylar... Tarım sektöründe emeğinizi, ürünlerinizi ve mahsullerinizi dijital dünyaya taşımak isterken karşılaştığınız bu bitmek bilmeyen engellerden sıkılmadınız mı? Artık durun ve derin bir nefes alın. Çünkü tam da aradığınız, "İşte budur!" dedirtecek o kusursuz çözüm karşınızda duruyor.</p>
      <h2>Modern Tarımın ve Ticaretin Dijital Üssü</h2>
      <p>Binlerce lira harcamaya, teknik uzmanların kapısında günlerce beklemeye ya da kafanızı karmaşık kodlarla bozmaya gerek yok. Sadece tarımsal faaliyetlerinizle, mahsullerinizle ve ticaretinizle ilgilenin; gerisini PazarTarla.com.tr'nin kusursuz altyapısına bırakın. Bu platform; üreticinin, çiftçinin, kooperatiflerin ve tarım makineleri tedarikçilerinin sesini doğrudan milyonlarca potansiyel alıcıya ulaştırmak için tasarlandı.</p>
      <p>Yıllardır süregelen geleneksel pazarlama yöntemleri, mahsulün tarlada değerini bulamaması veya aracıların kazancınıza ortak olması kaderiniz değil. Kendi iş yerinizi, kendi dijital mağazanızı tamamen bağımsız bir şekilde bu çatı altında açabilir; ürünlerinizi en net görseller ve en güçlü açıklamalarla doğrudan tüketicinin beğenisine sunabilirsiniz.</p>
      <h2>Neden PazarTarla.com.tr?</h2>
      <p>Sıfır Teknik Yük, Maksimum Verim: Kodlama bilmenize, sunucu kiralamanıza veya tasarımcı peşinde koşmanıza gerek kalmadan dakikalar içinde kendi dükkanınızı kurun.</p>
      <p>Yüksek Maliyetlere Son: Piyasadaki devasa e-ticaret bütçelerini unutun. Sadece yılda 2.500 TL gibi inanılmaz ekonomik bir yatırımla tüm yıl boyunca kesintisiz satış yapın.</p>
      <p>Doğrudan Müşteri Ağı: Aracıları ortadan kaldırın; mahsulünüzü, makinelerinizi ve ticari mallarınızı doğrudan alıcısıyla buluşturun, kazancınız cebinizde kalsın.</p>
      <p>Geniş Altyapı ve Güçlü Destek: Arkanızda duran sağlam teknolojik altyapı ve her adımda yanınızda olan profesyonel destek ekibiyle asla yalnız kalmayın.</p>
      <h2>Emeğinizin Değerini Dijitalde Katlayın</h2>
      <p>Bir tarım işletmesinin veya üreticinin en değerli varlığı zamanı ve emeğidir. Tarlada dökülen her damla alın terinin karşılığını dijital dünyada eksiksiz almanız gerekiyor. PazarTarla.com.tr, sadece bir ilan sitesi değil; üreticinin gururla ayağa kalktığı, ticari mallarını hak ettiği değerden sergilediği bir inovasyon merkezidir.</p>
      <p>Bugün atacağınız bu küçük adım, yarın milyonlarca müşteriye açılan devasa bir kapının anahtarı olacak. Koltuğunuzdan kalkmadan, zahmetsizce ve bütçenizi sarsmadan kendi dijital mağazanızı kurmanın şimdi tam zamanı.</p>
      <p>Gelin, bu yolda el ele verelim; tarımın gücünü dijitalin imkanlarıyla birleştirip geleceği birlikte inşa edelim. PazarTarla.com.tr'de yerinizi alın, bu eşsiz fırsatla kazanan siz olun!</p>
    </article>
    <button className="pt-about-cta" type="button" onClick={onPackages} data-testid="button-about-packages">Paketleri incele</button>
  </section>;
}
