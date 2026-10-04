# Sponsorlar / Çözüm Ortaklarımız

- Mevcut `advertisements` tablosu ve `site-advertisements` Storage bucket kullanılır.
  Yeni tablo, yinelenen sponsor kayıtları veya kullanıcı/ilan değişikliği yoktur.
- Aktif görsel reklamlar ana sayfada sponsor ızgarasında görünür; videolar mevcut
  video reklam alanında kalır. Logo/banner görselleri kırpılmaz. Hedef URL isteğe
  bağlıdır; yalnız güvenli http/https adresleri kabul edilir.
- Yönetici: yeni sponsor, başlık/URL/görsel güncelleme, duraklat/yayınla ve silme.
  Silme öncesi onay alınır. Metadata değişikliği revision kontrolü kullanır.
- Yeni görseller en uzun kenarı 1600 piksel olacak şekilde WebP'ye optimize
  edilir; şeffaflık korunur. Küçük görsel daha verimli değilse orijinali korunur.
  Var olan dosyalar topluca dönüştürülmez. Görseller lazy/async yüklenir.
- Görsel değiştirme yeni benzersiz dosya yükler, aynı reklam ID/revision
  üzerinde atomik PATCH uygular. Eski medya yalnız yeni kayıt doğrulandıktan
  sonra Storage API ile kaldırılır. Belirsiz cevapta dosya silinmez; aynı
  taslakla tekrar deneme mevcut yüklemeyi kullanır.

## Canlı aktivasyon ayrıca onay gerektirir
DATA_PROTECTION.md uygulanır. Başarılı şifreli yedek ve ayrı kullanıcı onayı
olmadan canlı SQL veya frontend yayını yapılmaz.

Mevcut reklam altyapısı kurulmuş olmalıdır. Görsel değiştirmeye ek sütun
yetkisi veren `reviewed_changes/20261004_sponsor_media_replace.sql` dosyasını
yetkili operatör inceler ve onaydan sonra uygular. Mevcut admin-only restrictive
RLS değişmez. Tarihî migration dosyaları ve otomatik güvenlik allowlist'i
değiştirilmez. SQL kurulumu hiçbir kaydı veya dosyayı değiştirmez/silmez.

Üretim öncesi ayrı ortamda anonim/üye UPDATE reddi, yönetici görsel değiştirme,
eski revision reddi ve aktif/pasif görünürlüğü doğrulanmalıdır.