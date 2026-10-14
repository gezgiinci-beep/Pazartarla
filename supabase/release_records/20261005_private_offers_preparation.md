# Teklif Pazarı — yedek ve ayrı test hazırlığı

## Yetki sınırı

Kullanıcı gerçek teklif sistemini istedi ve yedek doğrulaması ile ayrı
Supabase test ortamının hazırlanmasını onayladı. Bu aşama canlı SQL uygulama,
Vercel yayın veya gerçek kullanıcı/ilanlar üzerinde test izni değildir.
Örnek ilanlar yalnız geliştirme önizlemesinde kalır.

## Bu hazırlıkta doğrulananlar

- Salt okunur Vercel kontrolünde www, `pazartarla-1` projesindeki READY
  `dpl_EV87aQH9BeD3dpmQmgMysBkh2F4G` deployment'ına bağlıdır.
  Kaynak `fix/www-store-panel-login-20261005` dalının
  `858f0f161da3c782410a0249687632c6fd556afd` commit'idir.
- Ayrı apex alan adı `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` üzerinde görülmüştür;
  hiçbir alias veya Vercel ayarı değiştirilmedi. İki ilgili projede otomatik
  özel alan adı ataması kapalıdır; başka projelerin ayarları bu kapsamda değildir.
- Mevcut www commit'i repo dışında temiz, detached bir checkout olarak alındı.
  Yedek kodu bu checkout'tan çalıştırıldı; geliştirme kodu canlı kaynak diye
  arşivlenmedi.
- Eksik resmi Supabase CA dosyası, resmi Studio custom-content
  yapılandırmasındaki sertifika adresinden sağlandı. Sertifika geçerliliği
  ve öz-imzası kontrol edildi. Yedek bağlantısında `verify-full` TLS ve
  `default_transaction_read_only=on` korundu.
- Yeni şifreli veritabanı ve tam www kaynak kodu yedeği repo dışı özel dizine
  alındı. Backup yürütücüsünün PostgreSQL arşiv başlığı ve gerekli TABLE DATA
  kontrolleri başarılıdır. Receipt'teki kod commit'i www kaynağıyla eşleşir.
  Şifreli dosyalar, özel receipt ve kişisel veriler repoya/Library'ye eklenmedi.
- `node --test tests/private-offers.test.mjs`: yedi kontrol başarılıdır.
  `node scripts/check-private-offers-local.mjs`: ayrı, geçici UNIX-socket
  PostgreSQL üzerinde teklif gizliliği, ürün bazında katılım, doğrulanmış
  kimlik, karşı teklif/kabul, iletişim açılması, RLS ve kotalar başarılıdır.
  Bu kontroller gerçek Supabase Auth/PostgREST oturumlarını kanıtlamaz.

## SQL adayı

`supabase/reviewed_changes/20261005_private_listing_offers.sql`

SHA-256:
`295a056e194ada4d63eb2019e10ef10ca94a6c2f699bd688c888c796a1df3842`

Bu hash uygulama onayı veya canlı kurulum kanıtı değildir.

## Açık kalan koşullar

1. Kullanıcının ayrı, gerçek veri içermeyen Supabase test projesinin
   bağlantısı henüz sağlanmadı. Mevcut canlı veya preview bağlantısı test
   hedefi olarak kullanılmayacak. Gerekli anahtarlar yalnız güvenli secret
   akışından alınmalı; sohbet veya repoya yazılmamalı.
2. Test projesinde incelenmiş şema, sentetik doğrulanmış hesaplar ve ilanlarla
   gerçek Auth/PostgREST kontrolleri henüz yürütülmedi. İlan sahibi erişimi,
   yabancı/anonim erişim reddi, oturum kaybı, eski snapshot reddi ve pending
   kaydın anonim görünürlükten çıkması ayrıca doğrulanmalı.
3. Yedeğin bağımsız kopyası, kısıtlı ortamda tam kurtarma provası ve Storage
   fotoğraf baytlarının korunması henüz doğrulanmadı. Receipt açıkça
   `restoreDrillVerified:false`, `storageObjectBytesIncluded:false` kaydeder.
   Arşiv okunabilirliği bunların yerine geçmez; özel kurtarma anahtarı
   kullanıcıda kalmalı ve bu geliştirme ortamına istenmemeli.
4. Yeni teklif SQL'inin üretimde mevcut gövde/izin/bağımlılıklarla uyumu,
   mevcut verileri koruma kontrolü ve www kaynaklı dar yayın adayı
   tamamlanmadan canlı SQL/yayın onayı istenmez.

Bu hazırlıkta canlı SQL kurulumu, ilan/kullanıcı güncellemesi, test kaydı,
Vercel deployment başlatma veya yayın yapılmadı. Gerçek teklif sistemi
henüz canlıya alınmış sayılmaz.
