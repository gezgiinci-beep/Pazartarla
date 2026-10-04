# Canlıya geçiş hazırlığı — 4 Ekim 2026

## Sonuç: yayın henüz hazır değil

Bu hazırlık canlı veritabanında, Vercel ayarlarında veya main dalında değişiklik
yapmaz. İlanlar, kullanıcılar ve fotoğraflar üzerinde test yapılmamıştır.

## Doğrulananlar

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

## Main ile yalnız www yayınının çakışması

`pazartarla-1` (www) ve `pazartarla` (ayrı apex projesi) aynı deponun main dalını
izler. İkisinde de `autoAssignCustomDomains=true` görülmüştür. Main birleştirmesi
bu nedenle iki canlı adresi etkileyebilir.

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
   Alan adı sınırı çözülmeden taslak PR birleştirilmez.
7. Son yayını proje sahibi başlatır; www yeni sürümü ve ayrı apex sürümünün
   değişmeden kaldığı ayrıca doğrulanır.

Resmi yayın açıklaması:
https://vercel.com/docs/deployments/promoting-a-deployment