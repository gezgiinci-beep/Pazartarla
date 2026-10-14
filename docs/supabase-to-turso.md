# Supabase → Turso geçişi (14 Ekim 2026 canlı durumu)

## Canlı durum

- `www.pazartarla.com.tr` Vercel Production'da yayında ve Turso Production veritabanına bağlıdır. `pazartarla.com.tr` bu adrese yönlenir; yalnızca `www` takma adı değiştirildi.
- Supabase'den daha önce doğrulanmış 27 tablo/443 kayıt ve 12 hesap Turso `pazartarla-production` veritabanında korunuyor. Bu veri tekrar dışa aktarılmadı veya yeniden kopyalanmadı; `pazartarla-migration-test` yalnız test veritabanıdır.
- Üretim ilan API'si 22 ilanı, reklam API'si 3 reklamı, site ayarları API'si geçerli JSON döndürüyor. Ana ilan API'si 14 MB'lık eski SEO/metaveri ve gömülü resimleri artık ana liste yanıtında döndürmüyor.
- Eski Turso ilan kayıtlarındaki 36 resim (6.452.387 bayt) Vercel Blob'a taşındı; canlı API yanıtındaki 20 Blob URL'sinin tamamı ve toplam 35 benzersiz görünür Blob adresi HEAD isteğiyle doğrulandı. Eski SEO alanı liste yüklemesinden ayrıldı ve aşırı büyük içerik güvenli biçimde boş döndürülüyor.
- Supabase'deki mevcut e-posta akışı mevcut auth mailer üzerinden Turso akışına hazırdır; yinelenen bir sağlayıcı veya şablon eklenmedi. Üretim gönderim kapısı kapalıdır ve gönderen/sağlayıcı doğrulanıp gerçek test yapılmadan açılmaz.
- Supabase devre dışı bırakılmadı veya silinmedi. Storage'daki üç reklam dosyası ile henüz Turso'ya taşınmamış eski yönetici akışları Supabase'e bağlı olabilir; geri dönüş ve kalan geçişler için kaynak korunuyor.

Alttaki tarihli kayıtlar geçiş geçmişini açıklar; güncel karar için bu bölüm esas alınmalıdır.

## Seçilen yön

- Web uygulaması Vercel'de kalır.
- İlişkisel iş verileri için uzak SQLite uyumlu Turso hedeflenir. Vercel'in yerel diskindeki SQLite dosyası kullanılmaz; Functions dosya sistemi kalıcı değildir.
- Fotoğraf ve reklam dosyaları SQL veritabanına gömülmez. Vercel Blob yeni ilan fotoğraflarını ve taşınan eski ilan görsellerini barındırır; üç eski reklam dosyası Supabase Storage'da korunur.
- Supabase geri dönüş ve henüz taşınmamış özellikler için açık kalır; www'deki temel ilan, ayar ve oturum API yolları Turso Production kullanır.

## Kapsam ve mevcut durum

13 Ekim 2026'da, Supabase SQL bağlantısı salt okunur olarak kullanılabildiği için `public` ve `private` şemalarındaki 27 uygulama tablosunun 443 kaydı kullanıcı tarafından oluşturulan `pazartarla-migration-test` Turso veritabanına kopyalandı ve tablo başına kayıt sayıları doğrulandı. Supabase kaynak kayıtları değiştirilmedi. Özel şema tabloları test veritabanında `private__<tablo>` adıyla tutulur.

Ayrı `pazartarla-production` Turso veritabanı da 13 Ekim 2026'da açıldı. Güncel Supabase SQL kaynağından aynı 27 uygulama tablosu/443 kayıt ve 12 hesabın güvenli giriş alanları buraya doğrudan kopyalanıp doğrulandı; 22 onaylı ilan ve 1 ortak site ayarı bulundu. Test veritabanı Production'a bağlanmadı. Production erişim değişkenleri ve uygulama bayrakları Vercel Production için yapılandırıldı; 14 Ekim'de `www` bu sürüme geçirildi.

12 Supabase Auth hesabının sabit kullanıcı kimliği, normalize e-postası, bcrypt parola özeti, e-posta doğrulama zamanı ve engelleme/silme durumu Turso'ya aktarıldı; 10 hesap doğrulanmış, 1 hesap yönetici kaydıyla eşleşiyor. Supabase Auth kimlik sağlayıcı kayıtları, mevcut oturumlar, refresh/reset/doğrulama token'ları ve ham kullanıcı metaverisi taşınmadı. Supabase kaynak kayıtları korunuyor.

Supabase Storage'da 3 reklam dosyası (toplam 4.302.755 bayt) kaldı; `listing-media` kovasında dosya yoktu. Eski ilan fotoğrafları kayıtların içine gömülüydü; canlı kesimde 36 görsel Vercel Blob'a taşındı. PostgreSQL foreign key/check kısıtları, RPC ve RLS davranışları bire bir taşınmış sayılmaz.

Bu aşamada:

- Turso sunucu bağlantı modülü eklendi.
- `listings`, `site_settings`, `advertisements` için ilk SQLite uyumlu şema eklendi.
- `app_users`, oturum, giriş ve e-posta eylem tabloları `pazartarla-migration-test` veritabanında bulunuyor. Oturumların ham token'ı yerine HMAC, tek kullanımlık e-posta/parola bağlantılarının SHA-256 özeti saklanır; parolalar bcrypt ile korunur.
- `/api/auth/signup`, `/api/auth/resend-verification`, `/api/auth/verify-email`, `/api/auth/request-password-reset` ve `/api/auth/reset-password` uçları eklendi. Doğrulama bağlantıları 24 saat, parola bağlantıları 1 saat geçerlidir; parola yenileme eski oturumları kapatır ve otomatik giriş yapmaz.
- `0003_auth_action_limits.sql` e-posta eylemleri için kimliği HMAC ile gizlenmiş zaman pencereli rate-limit tablosu oluşturur. Login/admin-login/session/logout uçları, aynı kaynak kontrolü ve veritabanındaki admin kaydı korunur.
- Turso oturumu ve parola doğrulaması Vercel Production'da açık; e-posta kayıt/doğrulama/sıfırlama gönderimleri özellikle kapalıdır. Kullanıcı e-posta sistemi kurulmasını istemedi. Üretim üye/yönetici ekranı, geçerli kullanıcı oturumuyla henüz uçtan uca doğrulanmadı.
- Hesap ekranındaki kayıt, e-posta doğrulama, doğrulama e-postasını yeniden isteme ve parola kurtarma kodu Turso seçeneğine bağlandı. Eylem token'ı URL sorgusunda değil URL parçasında taşınır; kullanıldıktan sonra tarayıcı adresinden temizlenir. E-posta kodu gerçek ileti göndermeden taklit göndericiyle test edildi.
- Onaylı ilan API'si yalnızca kart verilerini döndürür; eski SEO/blob alanları ayrı uçta sınırlandırılır. Başlangıç yanıtına gömülü medya ve çok büyük SEO metaverisi eklenmez.
- `VITE_LISTINGS_BACKEND=turso` seçeneğiyle yalnızca herkese açık ilan okumaları yeni API'ye yönlendirilebilir; varsayılan değer Supabase'tir.
- `GET /api/site-settings` ortak ayarları Turso'dan okur. `PATCH /api/site-settings` tek alan ve revision kontrolüyle günceller; aynı kaynak, yönetici kaydı ve son 15 dakikada parola ile yönetici yeniden doğrulaması zorunludur. Yazma, Turso Auth arka ucu kapalıysa reddedilir.
- `VITE_SETTINGS_BACKEND=turso` Production'da etkin; ayar yazmaları Turso yönetici oturumu ve sunucu tarafı yetki/revision kontrolleriyle korunur.
- `GET /api/store-membership-data` salt okunur plan/mağaza sayfalarını, oturum varsa üyenin kendi kayıtlarını ve doğrulanmış yönetici oturumunda yönetici listesini döndürür. Kişisel/admin yanıtları önbelleğe alınmaz.
- `POST /api/store-membership/publication` mağazayı yayından kaldırma/yeniden yayımlama işlemini yalnızca aktif üyeliği olan mağaza için; Turso'daki yönetici kaydı, yakın zamanda yönetici parolasıyla yeniden doğrulama, aynı kaynak ve revision kontrolüyle uygular. Endpoint henüz mağaza yönetimi arayüzüne bağlanmadı.
- `POST /api/store-membership/mutate` mağaza başvurusu, profil düzenleme, tek kullanımlık 30 günlük deneme ve yönetici onay/red işlemlerini Turso üzerinde anlık transaction ile yürütür. Mağaza üyeliği ekranı Turso oturumunda bu API'leri kullanır. Ödeme onayı hâlâ yönetici tarafından dışarıda doğrulanır; API ödeme çekmez, yalnızca referansı tekil kaydeder.
- İlan gönderimi ve yönetici onayı Turso API'sinde uygulanmış ve Production bayrakları açılmıştır. Teklifler ve diğer eski yönetici işlemlerinin Supabase bağımlılıkları ayrıca doğrulanmalı; Supabase kaynakları şimdilik korunmalıdır.
- `0002_store_publication.sql` ve yeni `0003_auth_action_limits.sql` geçişleri test ve Production veritabanlarına uygulandı. Eski mağazalar `is_public=1` varsayılanıyla korunur; veri aktarım araçları test hedefini ve açıkça onaylanan tek Production hostname'ini ayrı ayrı doğrular.
- Şema ve endpoint için canlı veritabanına bağlanmayan testler eklendi.
- Teste yönelik, hedef veritabanı adını sabitleyerek yalnızca `public`/`private` uygulama kayıtlarını kopyalayan migration aracı eklendi.
- Teste yönelik Auth aktarımı yalnızca hesap giriş alanlarını taşır; tekrar çalıştırma, önceki Auth migration kaydı varsa mevcut test hesaplarının üstüne yazmamak için durur.
- Gerçek test veritabanındaki 22 onaylı ilan, mevcut Turso okuyucusu üzerinden başarıyla okundu; ilgili 12 test geçti.
- Bu test uygulamasında yönetici hesabı eşleşmesi doğrulandı; bu, canlı yönetici API yetkilendirmesinin Turso'ya geçtiği anlamına gelmez. Yabancı anahtarlar, check kısıtları, indekslerin tamamı, RPC'ler ve RLS kuralları hâlâ tamamlanmalıdır.

## Korunan kaynaklar ve geçiş sınırları

- Canlı Supabase'e yazılmadı, veri silinmedi ve Supabase devre dışı bırakılmadı.
- Vercel'de yalnız `www.pazartarla.com.tr` yeni Production sürümüne bağlandı; eski yayın silinmedi ve apex alan adı www'ye yönlenmeye devam ediyor.
- `pazartarla-migration-test` veritabanı test amaçlı kaldı; ayrı Production veritabanı doğrudan Supabase kaynağından dolduruldu.
- Supabase Auth oturumları ve parola/e-posta token'ları aktarılmadı. Reklam Storage'ındaki 3 dosya Supabase'de kaldı; Vercel Blob Production erişimi korunuyor.

## Kalan doğrulama ve geçiş işleri

1. Gerçek kullanıcı ve yönetici oturumuyla giriş, üyelik, ayar ve yönetim ekranlarını canlı www'de doğrulamak; testte gerçek parolalar veya kayıtlar kullanmamak.
2. İlan sahibi düzenleme/arşivleme/geri alma akışlarını ve kalan eski yönetici/teklif işlemlerini Turso'ya taşımak; Supabase kullanan her API yolunu envanterlemek.
3. Supabase Storage'daki 3 reklam dosyasını Vercel Blob'a taşıyıp içerik özetlerini doğrulamak ve reklam yönetim uçlarının tamamını Turso'ya bağlamak.
4. İletişim deposu ve diğer legacy yönetici işlevlerinin Supabase bağımlılıklarını tamamlamak. E-posta gönderimini kullanıcı açıkça istemedikçe kurmamak.
5. Geri dönüş penceresi kapanana kadar Supabase kaynak verisini ve medyayı silmemek.

Yeni ilan gönderimi yalnız doğrulanmış Turso oturumu, sunucu tarafı kategori/kota kontrolü ve tek işlemde ilan+gönderim kaydı ile çalışır. Yönetici onayı veritabanındaki admin kaydı ve 15 dakikalık taze parola doğrulaması ister; eski inceleme anlık görüntüsüyle karar kaydı reddedilir. Production'da bu akışlar Turso bayraklarıyla etkin; Replit önizlemesinde yazma kapalıdır.

Turso ilan formundaki yeni fotoğraflar doğrulanmış oturumla Vercel Blob'a yüklenir. İstek aynı kaynaktan gelmeli; her dosya JPEG/PNG/WebP/GIF olmalı ve 2 MB'ı aşmamalıdır. Dosya baytları Turso'ya yazılmaz; Blob URL'si ilan kaydında saklanır. Eski Turso kayıtlarındaki gömülü ilan görselleri 14 Ekim'de Blob'a taşındı; Supabase'deki üç reklam dosyası ise ayrı geçiş bekliyor.

Vercel'in 23 Eylül 2026 tarihli Hobby Blob belgeleri ayda 1 GB depolama, ilk 10.000 basit işlem, ilk 2.000 gelişmiş işlem ve ilk 10 GB veri aktarımı içerdiğini; Blob kullanım sınırları aşılırsa ek Blob kullanım bedeli alınmayıp erişimin 30 gün geçene kadar durabileceğini belirtir. CDN istekleri ve Fast Origin Transfer standart Vercel CDN koşullarına tabidir; www'de etkinleştirmeden önce kullanım paneli izlenmelidir. `pazartarla-listing-photos` deposu `pazartarla-1` projesinde `iad1` bölgesinde oluşturuldu ve public ilan görsellerine uygun erişimle bağlandı. `BLOB_READ_WRITE_TOKEN` Production ile sınırlandı; Preview/Development hedeflerinde yoktur. Turso auth, ilan yazma ve medya bayrakları kapalı olduğundan fotoğraf endpoint'i çalışmaz. Uygulama yayını veya www alias aktarımı yapılmadı.

Turso'nun ücretsiz katmanı mevcut küçük veritabanı boyutuna yeterli görünür; gerçek istek hacmi ve limitler geçiş öncesinde hesap panelinden doğrulanmalıdır. Dosya aktarım kotası/ücreti ayrıca izlenmelidir.
