# İlan sahibi düzenlemesi

## Davranış
- “İlan Ver” bölümündeki kendi gönderimlerinde ve kendi ilan detayında
  **İlanı Düzenle / Güncelle** butonu bulunur.
- Sunucu doğrulanmış ilan sahibini veya mevcut yetkili yöneticiyi kontrol eder.
  Eski, sahibi olmayan kayıtlar otomatik olarak bir kullanıcıya atanmaz.
- Sahibin başlık/fiyat/kategori/alt kategori/konum/açıklama/satıcı/telefon
  değişikliği aynı ID üzerinde yapılır ve **pending** durumuna döner.
  Yeniden onaylanana kadar kamuya görünmez. Değişiklik olmayan kayıt aynı kalır.
- Yönetici düzenlemesi mevcut statüyü korur. Mevcut yönetici medya/vitrin
  araçları ayrıca korunur. Kullanıcı medya veya vitrin metadata'sını değiştiremez.
- İlk tarih/12 takvim aylık süre/ID/sahip/kota korunur. Arşivdeki ilanı üye düzenleyemez;
  yönetici düzenleyebilir ama yayın süresini yenilemez.
- Güncel satırın SHA-256 token'ı kilit altında yeniden kontrol edilir.
  Eski taslak yeni bir değişikliği ezmez; hata formu kapatmaz.
- Yönetici onay/red işlemi kartta görülen **aynı snapshot token'ına** bağlıdır.
  Kullanıcı bekleyen ilanı değiştirirse eski karar reddedilir; güncel içerik
  yeniden incelenmelidir. Galeri/SEO kaydı da açılış snapshot'ına bağlıdır
  ve yalnız `image`/`seotags` alanlarını yazar; metin/fiyatı değiştirmez.

## Etkinleştirme — canlı SQL kurulumu uygulandı

**2026-10-05 kurulum sonucu:** Kullanıcı önce güvenli canlı kurulumu onayladı,
ardından bu işlem için ek güvenlik kontrollerinin ve yedek/kurtarma provalarının
durdurulmasını açıkça istedi. Daha önce ayrı sentetik PostgreSQL ortamında
test edilmiş reviewed SQL, hedef Supabase projesinde sertifika doğrulaması
açık bağlantıyla uygulandı. PostgreSQL altı CREATE FUNCTION ve başarılı COMMIT
sonucu döndürdü; PostgREST şema yenilemesi aynı transaction içindeydi.
İlan/kullanıcı satırlarını topluca değiştiren bir kurulum işlemi çalıştırılmadı.
Tam kurtarma provası ve Storage-byte kopyası doğrulanmış değildir; bu işlem
sonrasında yeni güvenlik testi veya kurtarma provası çalıştırılmadı.
Yeni Vercel frontend deployment'ı başlatılmadı. Önceden yayındaki düzenleme
arayüzünün sunucu bağımlılığı kuruldu; oturumlu canlı düzenlemenin uçtan uca
başarısı ayrıca doğrulanmış sayılmaz.

Bu, yalnız bu altı işlevin kurulumu için kullanıcının açıkça istediği
istisnadır; aşağıdaki koruma akışını veya sonraki veri/şema değişikliklerinin
güvenlik koşullarını kalıcı olarak kaldırmaz.

DATA_PROTECTION.md geçerlidir. Otomatik additive kontrolü gevşetmeyin veya
tarihî migration baseline'ını değiştirmeyin. Yetki fonksiyonları basit sütun
eklemekten farklı olduğundan dosya **reviewed_changes/** altında tutulur:
`20261004_owner_listing_edit.sql`.

1. Ayrı test projesinde inceleyin veya tamamen sentetik, geçici PostgreSQL
   kontrolünü çalıştırın: `node scripts/check-owner-edit-local.mjs`.
2. Başarılı şifreli DB+kod yedeği ve güvenli kurtarma akışı hazır olmadan
   canlıda SQL çalıştırmayın. Yedek altyapısının aktivasyon adımları önce tamamlanır.
3. Kullanıcı üretim yetki değişikliğini ayrıca onayladıktan sonra yetkili
   operatör dosyayı Supabase SQL Editor'de transaction olarak uygular.
   Fonksiyon sahipliği güvenilir DB yöneticisi olmalı; authenticated/anon
   fonksiyon sahibi olamaz. search_path kapalıdır; public EXECUTE yetkisi kaldırılır.
4. Uygulama mevcut admin-only doğrudan UPDATE/DELETE politikalarını **gevşetmez**.
   Üyeler yalnızca alan izin listeli RPC'yi çağırır; bilinmeyen eski politikalar
   zaten mevcut restrictive yönetici guard'ı ile sınırlıdır.
5. Başka hesap, anonim, eski token, yanlış kategori ve korunmuş alan yazma
   reddini ayrı test ortamında doğrulayın; ardından kod için ayrı yayın onayı.
   SQL uygulanmamışsa arayüz “sunucuda henüz etkinleştirilmemiş” hatasını gösterir,
   yerel sahte başarı veya yetkisiz doğrudan PATCH geri dönüşü yapmaz.
   Aynı dosyadaki `get_listing_moderation_queue`, `moderate_listing_snapshot` ve
   `update_listing_media` RPC'leri de birlikte uygulanmalıdır. Yeni frontend,
   eski koşulsuz moderation/gallery PATCH yoluna geri dönmez.

SQL kurulumu mevcut ilan kayıtlarını güncellemez/silmez. Testler gerçek
kullanıcı/ilanlar üzerinde çalıştırılmaz.

## 2026-10-05 güvenli kurulum hazırlığı

Bu hazırlık için kullanıcı onayı **yedek kontrolü ve hazırlık** kapsamındadır;
üretim SQL uygulama veya yayın onayı değildir.

**Sonraki kullanıcı onayı (2026-10-05):** Kullanıcı, mevcut verilere zarar
vermeden ilan düzenleme ve gerekli veritabanı altyapısının canlıda güvenli
kurulumunu açıkça onayladı. Bu onay yukarıdaki SQL dosyasının altı işleviyle
sınırlıdır; mağaza/bildirim kurulumu, veri silme, canlı fixture veya ayrı apex
projesinde değişiklik izni değildir. Tam kurtarma provası ve Storage kopyası
henüz doğrulanmadığından mevcut veri koruma önkoşulları tamamlanmış sayılmaz.
Onay tek başına bu önkoşulları kaldırmaz. Bu kayıt canlı SQL uygulandığı
anlamına gelmez. Daha sonraki açık durdurma talebi ve gerçek uygulama sonucu
yukarıdaki etkinleştirme bölümünde ayrıca kaydedilmiştir.

- Resmi Supabase CA, Studio'nun resmi sertifika adresinden indirilip CA niteliği,
  imzası ve geçerliliği kontrol edildi. Repo dışı özel yedek klasörü hazırlandı.
- Sertifika ve sunucu adı doğrulaması açık, `BEGIN READ ONLY` bağlantıda canlı
  PostgreSQL 17.6 ve önkoşul sütunlar kontrol edildi. Düzenleme/onay/medya için
  bu dosyada tanımlanan altı işlev henüz kurulu değil; mevcut yönetici/doğrulanmış
  üye yardımcıları ve ilan tablosunun RLS özelliği mevcut.
- İlan düzenleme ve veri güvenliği için 12 birim testi, tarihî migration koruması
  ve ayrı sentetik PostgreSQL SQL testi geçti. Canlı fixture kullanılmadı.
- PostgreSQL 17.5 istemcisiyle gerçek DB + temiz yerel kod checkout'unun şifreli
  yedeği alındı. Arşiv okunabilirliği kontrol edildi; şifreli dosyaların SHA-256
  değerleri repo dışındaki özel receipt dosyasına kaydedildi.
- Bu kod yedeği yerel checkout'u kapsar; Vercel'in canlı deployment kaynak
  commit'iyle aynı olduğu ayrıca doğrulanmadan canlı release arşivi sayılmaz.
- **Tam kurtarma provası yapılmadı. Storage fotoğraf baytları bu yedeğe dahil
  değil.** Arşiv okunabilirliği bunların yerine geçmez.

Hazırlanan SQL:
`supabase/reviewed_changes/20261004_owner_listing_edit.sql`

SHA-256:
`36a4dc44602f52c048640e9df08012d8e59b217ce3a7b754c475d1be001ad98c`

Kurulum altı işlevi ve sınırlandırılmış çağrı yetkilerini oluşturur; mevcut
ilan/kullanıcı kayıtlarını topluca değiştirmez veya silmez. İşlevlerin içindeki
UPDATE işlemleri yalnız ileride yetkili bir düzenleme/onay çağrısıyla çalışır.
Mevcut doğrudan UPDATE/DELETE RLS politikalarını gevşetmez.

### Üretime geçmeden önce

1. Şifreli yedeği bağımsız güvenli bir yere kopyalayın; yalnız bu çalışma
   ortamındaki kopyayı tek kurtarma noktası olarak kullanmayın.
2. Kullanıcının kurtarma özel anahtarı yalnız sahibinde kalacak şekilde,
   erişimi kısıtlı ayrı ortamda yedeği açma/geri yükleme provası yapın.
   Özel anahtarı bu repoya veya sohbete göndermeyin.
3. Storage dosyalarını ayrı, silme yapmayan kopyalama yöntemiyle koruyup
   fotoğrafın kendisinin erişilebilirliğini doğrulayın.
4. Güncel www kaynak sürümü ile yerel aday farklarını uzlaştırın. Gerekirse
   incelenen aday için yeni temiz kod + DB yedeği alın.
5. Kullanıcıya kapsamı, bu SQL hash'ini ve önkoşul kanıtlarını göstererek ayrı
   üretim SQL onayı alın. Önkoşullar tamamlanmadan dosyayı çalıştırmayın.
6. Kurulum sonrası salt okunur işlev/ACL/API kontrolü; ayrı sentetik ortamda
   üye düzenleme, yönetici onayı ve medya çakışma kontrolü; ardından yalnız
   www için yayın değerlendirmesi. Mağaza/SMS/e-posta kurulumu bu kapsamda yok.

## İzole tarayıcı önizlemesi

Replit'teki **İlan Düzenleme — YALNIZ TEST** önizlemesi
`/listing-edit-test/` yolundadır. Mevcut PazarTarla önizlemesinin bağlantılarını
değiştirmez. Gerçek `ListingEditor` kaynak bileşenini doğrudan kullanır; Supabase
istemcisi, anahtarı, kullanıcı oturumu veya uygulamanın başlangıç dosyası yüklenmez.

- Ayrı servis her başlangıçta sentetik tek ilan ve test aktörleri oluşturur.
  PostgreSQL yalnız rastgele geçici dizindeki UNIX socket üzerinden erişilir;
  TCP dinlemez ve ortam değişkenlerinden DB bağlantısı almaz.
- RPC adaptörü yalnız izin verilen düzenleme/onay fonksiyonlarını gerçek SQL
  ile çalıştırır. `owner`, `other`, `admin`, `anonymous` seçimi **test kimliğidir**,
  gerçek kimlik doğrulama değildir; Supabase Auth/PostgREST kurulumu test edilmez.
- Üye değişikliği `pending` olur ve anonim SELECT'ten kaybolur. Test yöneticisi
  güncel snapshot'ı inceleyip onayladığında tekrar görünür.
- Servis durdurulunca geçici DB kapatılır ve dizin silinir; yeniden başlatma
  tüm sentetik verileri sıfırlar. Test kaydı gerçek bir ilan değildir.
- Servis yalnız geliştirme manifest'ine kayıtlıdır; production build/serve
  tanımı ve package build komutu yoktur. Bu önizleme yayına alınacak bir uygulama
  değildir. Doğrudan package serve çağrısı da bilerek hata verir.

Fixture kontrolü:
`node --test tests/listing-editor-test-db.test.mjs`.
SQL güvenlik kontrolü:
`node scripts/check-owner-edit-local.mjs`.
