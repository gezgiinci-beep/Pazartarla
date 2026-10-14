# Canlıya geçiş hazırlığı

## Mağaza başvuru düğmesi — yalnız kurulum hazırlığı, 5 Ekim 2026

Kullanıcı “Hazırlığı yap; canlı veritabanı değişikliği için ayrıca onay iste”
seçeneğini onayladı. Bu izin SQL uygulama, Vercel yayını, yeni mağaza/ödeme
başvurusu oluşturma veya güvenlik kontrollerini atlama izni değildir.

### Güncel tanı

- Gerçek www JavaScript bağlantısıyla anonim, salt-okuma
  `get_store_membership_data(p_store_id:null)` isteği HTTP 404 / `PGRST202`
  döndürdü. Bu nedenle paket verileri yüklenemiyor; seçilebilir sunucu paketi
  olmayınca başvuru düğmesi güvenli biçimde pasif kalıyor. Düğmenin `disabled`
  koşulunu kaldırmak kayıt işlemini düzeltmez.
- Resmî Supabase Studio kaynağındaki sertifika indirme adresi doğrulandı ve
  önceden tanımlı fakat diskte bulunmayan CA dosyası resmî sertifikayla sağlandı.
  TLS sertifika ve sunucu adı doğrulaması kapatılmadı.
- Doğru Supabase projesinde `BEGIN READ ONLY` ile katalog kontrol edildi;
  transaction salt-okuma durumu `on`, sunucu PostgreSQL 17.6.
  Hiçbir gerçek başvuru, kullanıcı, ilan veya fotoğraf sorgulanıp kopyalanmadı.
- `public.get_store_membership_data`, `public.manage_store_membership`,
  `private.store_slot_counts`, `private.enforce_store_approval_capacity` ve
  beş özel mağaza tablosu katalogda yoktur.
- Temel yönetici/doğrulanmış üye/kota işlevleri, RLS'li yönetici ve gönderim
  günlüğü tabloları, `submitted_by` ve üretilmiş `expires_at` sütunları vardır.
  İşlev isimlerinin varlığı gövdelerinin/grant/policy uyumunu tek başına kanıtlamaz.
- Ayrı ilan düzenleme/onay RPC'leri de katalogda yoktur. Bu çalışmada bunlar
  kurulmadı. `STORE_MEMBERSHIPS_SETUP.md` bu altyapıyı ön koşul sayar; hangi
  bağımlılıkların gerçekten gerekli olduğu ve ayrı dosyanın kapsam/onayı,
  üretim uygulamasından önce ayrıca değerlendirilmelidir. Düğme düzeltmesi
  gerekçesiyle başka güvenlik veya ilan düzenleme SQL'i otomatik uygulanmaz.
- Mevcut öne çıkarma koruma trigger'ı bulunur. Bu düzeltme, sonraki kurulumda
  korunacak canlı davranışın parçasıdır; eski şema topluca tekrar çalıştırılmaz.

### İncelenen aday ve doğrulama

`reviewed_changes/20261004_store_memberships.sql` yereldeki dosyayla mevcut
www kaynak commit'inin GitHub dosyasında birebir aynıdır. SHA-256:
`053f48a5cd555c8351cf1faf965e5178be1a123f26b5a7c86a57b6d4d3711a2e`.
Bu hash bir canlı uygulama onayı değildir.

12 mağaza/veri güvenliği birim testi ve tarihî migration koruması başarılıdır.
`node scripts/check-membership-local.mjs` tamamen geçici, dış bağlantısız
PostgreSQL üzerinde sentetik verilerle başarılıdır: doğrulanmış üyelik, manuel
ödeme onayı, yetki reddi, mükerrer ödeme/istek güvenliği, ayrı kotalar, eşzamanlı
son kontenjan yarışı, süre sonu ve mevcut kayıtların korunması kontrol edilmiştir.
Bu yerel test, gerçek Supabase ortamında Auth/RLS/API kabul testi değildir.

Mağaza SQL'i yalnız paket okuması eklemez: özel tablolar/fonksiyonlar oluşturur,
gönderim kotası işlevini değiştirir ve onayda kapasite trigger'ı ekler.
Bu nedenle karmaşık SQL'i reddeden otomatik additive yürütücüsüne sokulamaz;
baseline/allowlist gevşetilmez. Ayrı inceleme ve kontrollü işlem gerekir.

### Canlı kurulum öncesi açık kapılar

1. Public yedek anahtarı geçerli olarak yapılandırılmış; özel anahtar istenmedi
   ve okunmadı. Repo dışı yedek dizini tanımlı, fakat diskte yoktur.
   Bu hedefte başarılı şifreli DB+kod yedeği receipt'i/kurtarma kanıtı yoktur.
   Bu, Supabase hizmetinin hiç yedeği olmadığı anlamına gelmez.
2. `pg_dump` ve `pg_restore` artık 17.5'tir; sunucuyla aynı ana sürümdedir.
   Önceki 16.15 istemci tespiti tarihîdir. Uyumlu araç bulunması yedeğin
   gerçekten alındığına veya geri yüklenebildiğine kanıt değildir.
3. Temiz, incelenmiş kaynak için yeni şifreli DB+kod yedeği ve kısıtlı ortamda
   kurtarma doğrulaması sağlanmalı. Storage fotoğraf baytları DB dump'ında yoktur;
   mevcut fotoğrafları yeniden taşıma bu hazırlığın kapsamında değildir.
4. Ayrı test projesi bağlantısı/işareti/CA yapılandırması yoktur. Gerçek kişisel
   veriler kopyalanmadan Auth/API yetki kontrolleri ayrı test ortamında tamamlanmalı.
5. Canlı işlem öncesinde SQL hash'i, mevcut fonksiyon gövdeleri/izinleri ve
   koruma trigger'ları yeniden doğrulanmalı. Korunan tabloların kilitli önce/sonra
   sayım ve eski-alan özetleri eşleşmezse transaction rollback yapılmalı.
   Yalnız SQL dosyasının BEGIN/COMMIT içermesi bu korumayı tek başına sağlamaz.
6. Bu kapılar tamamlandıktan sonra **ayrı açık canlı veritabanı onayı** istenir.
   Hazırlık onayı bu onayın yerine geçmez.
7. Onaylı kurulumdan sonra şema önbelleği yenilenip paket okuması ve gerçek
   doğrulanmış hesap akışı kontrol edilir. Zaten canlı olan frontend'e
   gereksiz cache adayı veya başka geliştirmeler eklenip yayınlanmaz.

**Sonuç:** güvenli hazırlık ve eksik altyapı tanısı tamamlandı; canlı kurulum
onayı henüz istenmedi çünkü veri koruma/kabul kapıları açık. Düğme henüz
çalışır hale getirilmedi. Canlı SQL, başvuru/ödeme test kaydı, Vercel alias
ataması, otomatik yayın ayarı veya fotoğraf değişikliği yapılmadı.

## Mevcut www düzeltmesini koruyan önbellek adayı — 5 Ekim 2026

**Kapanış kapsamı:** Kullanıcı ayrı canlı yayın sorusuna
“Hayır, adayı hazır tut; yayını değiştirme” yanıtını vermiştir.
Bu çalışma yalnız aday hazırlığı olarak kapanır; www önbellek güncellemesi
canlıya alınmamıştır. 5 Ekim 2026 10:25 UTC son salt okunur kontrolde aday
READY, www ve apex aşağıdaki aynı deployment'larında, iki otomatik özel
alan adı ataması da kapalıdır. Yayın/alias atama işlemi yapılmamıştır.
Canlı HTML/version.json kimlikleri, yeni HTTP önbellek başlıkları ve gerçek
açık-sekme/taslak davranışı gelecekte ayrı yayın onayından sonra doğrulanmalıdır.
Mevcut www'nin ekran görüntüsü sayfanın açıldığını gösterir; yeni adayın canlıda
çalıştığına veya giriş/ilan/mağaza işlemlerinin tamamlandığına kanıt değildir.

Yeni salt okunur kontrolde www alias'ı artık
`dpl_3VgyT6bJ8ARKUMHbmCEF6W2DmDsY` deployment'ını,
`fix/www-featured-only-20261005` dalındaki
`51d0b2871f64053e5965f799a46f3eb8635b69e5` kaynağını sunmaktadır.
Apex `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` üzerinde kalmaktadır.
İki projede de otomatik özel alan adı ataması kapalıdır.

Önceki önbellek adayının tam Git ağacı mevcut www ile karşılaştırıldığında
uygulama/öne çıkarma değişikliklerini geri alacağı görülmüştür. Bu nedenle eski
READY aday canlıya atanmamıştır. Üç noktalı GitHub karşılaştırması bu geri
almaları tek başına göstermediğinden tam dosya/blob karşılaştırması kullanılmıştır.

Kullanıcı, mevcut www düzeltmesini koruyan yeni bir aday hazırlanmasını ve
canlı yayın için ayrıca onay istenmesini seçmiştir. Yeni aday:
`98b12de30e307adb9b3897e4e994badeafad403e`,
`agent/www-cache-preserve-featured-20261005` dalındadır.
Taslak PR https://github.com/gezgiinci-beep/Pazartarla/pull/6
yalnız mevcut www kaynak dalını hedefler; main'e birleştirilmemiştir.
Mevcut www kaynağına göre tam olarak aynı sekiz önbellek/sürüm dosyası değişir.
`src/App.tsx`, öne çıkarma işlevleri, SQL ve medya dosyaları korunmuştur.
11 önbellek/Vercel/öne çıkarma testi ve yerel üretim derlemesi başarılıdır.

Yalnız `pazartarla-1` için
`dpl_BonQ5Vwj4Z367ximTa6qeHo26RZg` üretim ortamlı aday derleme başlatılmıştır.
Derleme başlatıldıktan sonraki kontrolde iki canlı alias da yukarıdaki
deployment'larında ve otomatik atamalar kapalıdır. Aday READY durumuna ulaştıktan
sonra da bu değerler değişmemiştir; kaynak SHA ve www proje kimliği eşleşmektedir.
Yerel HTML/sürüm JSON'u kimlikleri eşleşmiştir. Adayın gerçek bildirim koduyla
çalışan sentetik DOM kontrolünde ilan/yönetici taslakları korunmuş; odaklanma,
görünürlük, zamanlayıcı ve chunk hatası olayları otomatik yenileme yapmamıştır.
Yenileme yalnız düğmeye açık tıklama ile gerçekleşmiştir. Bu kontrol gerçek
tarayıcıda oturum/form yolculuğu veya canlı HTTP doğrulaması yerine geçmez.
Bu bir yayın onayı veya canlı geçiş kaydı değildir; ayrı sahip onayı gerekir.
Canlı HTTP başlıkları/sürüm kimlikleri yayın sonrasında doğrulanacaktır.
Veritabanı, RPC kurulumu, üyelik/mağaza hazırlığı veya fotoğraf taşıma yapılmamıştır.

## Önbellek güncellemesi — 5 Ekim 2026

Önbellek ve sürüm takibi PR'ı #4 GitHub `main` dalına birleştirildi:
`d0ef7315afd744cffe931f19fc451a2e7794f071`.
Bu birleştirme yalnız aşağıdaki sekiz dosyayı içerir:
`DEPLOYMENT_CACHE.md`, `build/releaseMetadata.mjs`,
`src/lib/releaseRefresh.js`, `src/main.tsx`,
`tests/cache-release.test.mjs`, `tests/vercel-install.test.mjs`,
`vercel.json` ve `vite.config.js`.
Yerel fotoğraf depolama farkları veya yeni SQL kurulumu dahil edilmedi.

Birleştirmeden hemen önce iki Vercel projesinde de
`autoAssignCustomDomains=false` yeniden doğrulandı.
Birleştirme sonrasında www alias'ı
`dpl_3yk3c8eB6Eydq8EFx6TtLX3BRkCm`, apex alias'ı
`dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` üzerinde değişmeden kaldı.
Dolayısıyla yeni `main` ile canlı www sürümü artık aynı değildir;
aşağıdaki 4 Ekim kontrolü tarihî bir durum kaydıdır.

Yeni derlemenin `target=production` olması, canlı alan adına atandığı
anlamına gelmez. Yayın hazırlığı, ilan/mağaza RPC'lerinin canlıda kurulup
doğrulandığı anlamına da gelmez. Bu işlem veritabanını, fotoğrafları,
otomatik yayın ayarlarını veya canlı alan adı yönlendirmelerini değiştirmedi.
Önbellek/sürüm ve Vercel yapılandırma kontrollerinin dokuz testi başarılıdır.
Yeni www derlemesi `dpl_5i7CSSgFFbwnjsqqpRX9kuLkEkNv` READY durumundadır.
Derleme hazır olduktan sonra da iki canlı alias'ın değişmediği ve otomatik
alan adı atamasının kapalı kaldığı tekrar doğrulandı. Vercel giriş koruması
sürüm JSON'u isteğini giriş sayfasına yönlendirdiği için yeni derlemenin
HTTP önbellek başlıkları dışarıdan doğrulanmış sayılmaz.

## Sonuç: mevcut www sürümü canlı; tam işlevsel geçiş doğrulanmadı

### Kullanıcının daralttığı kapanış kapsamı

Kullanıcı yedekleme ve şifreli anahtar adımlarının bu görevde atlanmasını ve
görevin mevcut kodla kapatılmasını istedi. Bu nedenle yeni anahtar istenmez,
DB/kod yedeği alınmaz ve kurtarma provası yapılmış gibi gösterilmez.
Bu kapsam değişikliği veri koruma yürütücüsünün kontrollerini kaldırmaz;
tarihî SQL tekrar çalıştırılmaz, baseline/guard değiştirilmez.

Son salt okunur Vercel/GitHub kontrolünde www alias'ı yine
`dpl_3yk3c8eB6Eydq8EFx6TtLX3BRkCm` deployment'ına bağlıdır. READY durumundaki
bu deployment `main` ile aynı
`a40eca08b83f6964285ee642862b645a7777dbb3` commit'ini sunmaktadır.
Mevcut GitHub kodu zaten www'de canlıdır; yeni deployment veya promote yapılmamıştır.
Apex alias'ı önceki kontrolle aynı
`dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` deployment'ında kalmıştır.
www'nin tarayıcı görüntüsü açılış ekranına ulaşmıştır; bu görüntü giriş,
ilan onayı veya paket işlemlerini uçtan uca doğrulamaz.

**Kapanış anlamı:** mevcut kod ve yayın durumu kayda alındı. Yeni canlı SQL
kurulmadı; daha önce eksik bulunan RPC'lerin kurulduğu veya ilan/mağaza
işlemlerinin canlıda tam çalıştığı iddia edilmez. Şifreli yedek, kısıtlı kurtarma
provası ve Storage-byte koruması doğrulanmamıştır. Yereldeki ayrı fotoğraf
depolama hazırlığı canlıya gönderilmemiştir. İlerideki SQL/yayın çalışmaları
ayrı yetkilendirme ve o çalışmanın veri koruma koşullarını gerektirir.

Bu kontrol oturumu canlı veritabanında, Vercel ayarlarında veya main dalında
değişiklik yapmamıştır. İlanlar, kullanıcılar ve fotoğraflar üzerinde test
yapılmamıştır. Aşağıdaki güncel bağlantı bulguları eski hazırlık durumundan
farklıdır; eski taslak PR ve otomatik yayın bilgileri artık güncel değildir.

## Güncel salt okunur kontrol — 4 Ekim 2026, 18:11 UTC

- GitHub `main` ve `agent/shared-site-settings-20261004` aynı commit'i gösterir:
  `a40eca08b83f6964285ee642862b645a7777dbb3`.
- PR #2 kapalı ve birleşmiş durumdadır. API'deki `draft=true` alanı tek başına
  PR'ın hâlâ açık taslak olduğu anlamına gelmez; `state` ve `merged` birlikte
  kontrol edilmiştir.
- İki Vercel projesinde de `autoAssignCustomDomains=false` görülmüştür.
  Bu oturum ayarı değiştirmemiş, ana dalı birleştirmemiş ve yayın başlatmamıştır.
- www alan adı alias'ı `dpl_3yk3c8eB6Eydq8EFx6TtLX3BRkCm` deployment'ına bağlıdır;
  bu deployment yukarıdaki eşitlenen commit'i kullanır ve READY durumundadır.
  Dolayısıyla www'nin önceki sürümde kaldığı varsayılmamalıdır.
- Ayrı apex alan adı alias'ı `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` deployment'ına
  bağlıdır; kaynak commit'i `0180939e982f64967978c810b2613ba66db644b4` olarak
  görülmüştür. Bu oturum için önceki alias karşılaştırma kanıtı olmadığından
  geçmiş yayın işlemlerinin etkisi hakkında ek garanti verilmez.
- GitHub ağacı kesilmeden okunmuş ve mevcut yerel dosyalar Git blob SHA-1
  değerleriyle karşılaştırılmıştır. Ortak yönetici güvenliği, ilan düzenleme/onay
  ve üyelik dosyalarında fark bulunmamıştır. `src/App.tsx`,
  `tests/listing-editor.test.mjs` ve `package.json` farkları yerelde hazırlanmış
  ayrı fotoğraf depolama çalışmasındandır. Eski uzaktaki dosyaların yerelde
  bulunmaması silinmeleri gerektiği anlamına gelmez. Yeni yayın adayı bu medya
  farkları ve yalnız yerelde bulunan medya dosyaları uzlaştırılmadan seçilmemelidir.
- 20 birim testi başarılıdır: veri güvenliği, üyelik, ilan düzenleme,
  yönetici erişimi ve Vercel paket yöneticisi yapılandırması.
- Tarihî migration koruması ve sentetik izole PostgreSQL kontrolleri başarılıdır:
  üye düzeltmesi/yeniden onay, eski snapshot ile kararın engellenmesi, medya
  yazma çakışması, manuel üyelik onayı, ayrı kotalar, son kontenjan yarışları,
  yönetici muafiyeti ve mevcut verinin korunması. Canlı fixture kullanılmamıştır.
- Yedek açık anahtarı, repo dışı yedek dizini ve resmi DB CA dosyası için
  yapılandırma bulunmamıştır. Test projesi yapılandırması da yoktur.
  `pg_dump` ve `pg_restore` hâlâ 16.15'tir; doğrulanmış 17.6 sunucusu için
  uygun istemci kurulmadan gerçek yedek alınamaz.
- Bu oturum canlı SQL kataloğunu yeniden sorgulamamıştır. Aşağıdaki eksik
  işlev tespitleri önceki salt okunur kontrolün kanıtıdır; şimdi kuruldukları
  varsayılmamalıdır. Yeni şifreli yedek, kısıtlı kurtarma kanıtı ve Storage-byte
  koruması doğrulanmadığından üretim SQL onayı henüz istenmemiştir.

**Güncel engel:** önce yedek/kurtarma kurulumu ve kanıtı, ardından ayrı açık
üretim SQL onayı gerekir. www'de kodun sunulması bu kapıları kaldırmaz.
Yayın durumu “hazır” değildir.

## Önceki hazırlık kontrolünde doğrulananlar (tarihsel kayıt)

- GitHub kaynak dalı: `agent/shared-site-settings-20261004`.
- Main için birleştirme isteği taslaktır:
  https://github.com/gezgiinci-beep/Pazartarla/pull/2
- Vercel önizleme derlemesi READY durumundadır; bu uygulamanın bütün işlemlerinin
  çalıştığını kanıtlamaz.
- Sertifika ve sunucu adı doğrulaması açık bir bağlantıda `BEGIN READ ONLY`
  kullanılarak canlı PostgreSQL kataloğu incelenmiştir.
- Tarihî migration dosyalarında tanımlanan fonksiyon adları katalogda vardır.
  Bu, bütün fonksiyon gövdelerinin, policy/grant'ların ve migration sürümlerinin
  doğru olduğunu veya bütün özelliklerin çalıştığını kanıtlamaz.
- Yeni ilan düzenleme/onay SQL dosyasındaki altı fonksiyon kurulu değildir.
- Mağaza paketleri SQL dosyasındaki dört yeni fonksiyon kurulu değildir.
  Kota işlevlerinin eski sürümleri zaten mevcuttur; isimlerinin bulunması
  paketli üyelik kotalarının etkin olduğu anlamına gelmez.
- GitHub API'sinde sıfır workflow ve sıfır workflow çalışması görülmüştür.
- Çalışma alanında şifreli yedek, başarı belgesi ve kurtarma provası kanıtı
  bulunmamıştır. Bu tespit, Supabase hizmetinde hiç yedek olmadığı anlamına gelmez;
  sağlayıcı yedeklerinin başarı/kurtarma durumu henüz doğrulanmamıştır.
- Canlı PostgreSQL 17.6; ortamın pg_dump/pg_restore araçları 16.15'tir.
  Gerçek yedek için PostgreSQL 17 veya daha yeni istemci gerekir.
- Başlangıç kontrolü ve 12 veri güvenliği/mağaza birim testi başarılıdır.
- İlan düzenleme/onay ve mağaza paketi SQL kontrolleri, yalnız sentetik verili
  geçici yerel PostgreSQL veritabanlarında başarılıdır. Bunlar canlı şemada
  değişiklik yapmamış ve gerçek kullanıcı yolculuklarını doğrulamamıştır.

## Önceki main / yalnız www yayın çakışması (tarihsel kayıt)

Önceki kontrolde `pazartarla-1` (www) ve `pazartarla` (ayrı apex projesi)
aynı deponun main dalını izliyor ve ikisinde de
`autoAssignCustomDomains=true` görülüyordu. Güncel kontrol yukarıdadır:
iki ayar da artık kapalıdır. Gelecekte her yayın adayında ayarlar ve gerçek
alan adı alias'ları yeniden okunmalıdır; kapalı ayar mevcut yayını geri almaz.

Main birleştirmesinden önce yetkili proje sahibi, ayrı apex projesinin
**Settings → Environments → Production → Branch Tracking →
Auto-assign Custom Production Domains** ayarını değerlendirmelidir. Kapatılması
build'i durdurmak değildir: yeni production build hazırlanabilir, fakat mevcut
alan adını otomatik devralmaz. Bu hazırlıkta bu ayar değiştirilmemiştir.

Apex projesinde ayar değişikliği yetkisi verilmezse main birleştirmesi beklemelidir.
Altyapı kontrolleri tamamlandıktan sonra yalnız www projesindeki önizlemeyi proje
sahibinin **Promote to Production** ile yayımlaması ayrı bir seçenektir.
Önizlemeden production'a geçiş yeniden derleme yapar ve production ortam
değişkenlerini kullanır; preview başarısı production yapılandırmasını kanıtlamaz.

## Sıradaki güvenli adımlar

1. `DATA_PROTECTION.md` uyarınca kurtarma özel anahtarı yalnız sahibinde kalacak
   şekilde RSA anahtar çifti hazırlayın. Bu ortama yalnız açık/public anahtar verilir.
2. Uygun PostgreSQL istemcisi, resmi CA ve repo dışı özel yedek hedefi yapılandırın.
   Temiz, incelenmiş kaynak sürümünün şifreli DB+kod yedeğini alın; manifest ve
   arşiv okunabilirliğini doğrulayın. Başarı belgesi tam kurtarma provası değildir.
3. Ayrı, erişimi kısıtlı kurtarma ortamında DB kurtarma ve fotoğraf dosyası
   erişimini doğrulayın. DB dump Storage dosya baytlarını içermez.
4. Ayrı üretim SQL onayından sonra yetkili operatör önce
   `reviewed_changes/20261004_owner_listing_edit.sql`, sonra
   `reviewed_changes/20261004_store_memberships.sql` dosyalarını inceleyip uygular.
   Sponsor medya değiştirme için `20261004_sponsor_media_replace.sql` içindeki
   sütun yetkisi de ayrıca kontrol edilir; fonksiyon isimleri bu yetkiyi kanıtlamaz.
   Baseline değiştirilmez; tarihî migration'lar yeniden topluca çalıştırılmaz.
5. İzole ortamda oturum açma, üye düzenlemesi, yönetici onayı, manuel mağaza
   üyeliği, kotalar ve veri korunmasını doğrulayın. Canlıda fixture/seed/reset yoktur.
6. Birleşen diğer geliştirmeler varsa yayın adayını yeniden belirleyin.
   PR #2 zaten birleşmiştir; yeniden birleştirme yapılmaz. Yeni bir PR/aday için
   alan adı sınırı ve onayları tekrar doğrulanır.
7. Son yayını proje sahibi başlatır; www yeni sürümü ve ayrı apex sürümünün
   değişmeden kaldığı ayrıca doğrulanır.

Resmi yayın açıklaması:
https://vercel.com/docs/deployments/promoting-a-deployment