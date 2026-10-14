# Teklif Pazarı — www canlı yayın kaydı

## Kullanıcı kararı ve sınır

2026-10-05 tarihinde kullanıcı canlı veritabanı kurulumunu onayladı, ardından
“Yedek doğrulamasını atlayıp canlıya geçişi tamamla” ve “Canlıya ver artik”
talimatlarıyla bu işlem için geri açılma doğrulamasının atlanmasını ve yayını
istedi. Bu istisna sonraki işlemlerin yedek/inceleme kurallarını kaldırmaz.

Yalnız `pazartarla-1` projesindeki `www.pazartarla.com.tr` yayımlandı.
Ortak main merge edilmedi; apex projesinin ayarları ve alan adı değiştirilmedi.
Bu yayın yalnız Teklif Pazarı'nın yedi src dosyasını içerir. Yıllık paket,
ücretsiz deneme, tanıtım, demo ve fotoğraf/geçmiş düzenleme adayları bu yayında
birleştirilmedi.

## Kaynak ve yayın

- Başlangıç commit'i: `858f0f161da3c782410a0249687632c6fd556afd`.
- Ayrı yayın dalı: `release/www-private-offers-20261005`.
- Yayın commit'i: `aaea85548524df960a27e483eb7ad7916ebac22a`.
- READY production dağıtımı: `dpl_DwSo9vZYSp5DyiB19h6DDgeMHhd3`.
- Vercel promotion başarılı; gerçek www alias'ı bu dağıtımı gösterdi.
- Ayrı apex alias'ı önceki `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` üzerinde kaldı.
- Doğrudan sayfa: https://www.pazartarla.com.tr/?teklifler=1

## Veritabanı ve koruma

`20261005_private_listing_offers.sql` SHA-256:
`295a056e194ada4d63eb2019e10ef10ca94a6c2f699bd688c888c796a1df3842`.

Kurulum 2026-10-05T18:09:47Z tarihinde tek transaction olarak COMMIT edildi.
Resmi CA ile doğrulanmış TLS kullanıldı. İşlem öncesi yeni şifreli DB+yerel
kod yedeği alındı; başlangıçtaki canlı Git ağacının 151 blob'u ayrıca Git
hash'leriyle doğrulanıp şifreli canlı kaynak arşivi saklandı. Arşivler repo
dışında, erişimi kısıtlı tutuldu; dosyalar/anahtarlar Library'ye eklenmedi.

26 mevcut public/private, Auth ve Storage metadata tablosunun orijinal
kolonları, kayıt sayıları ve içerik özetleri işlem öncesi/sonrası aynı kaldı.
Gerçek kullanıcı, ilan, teklif, mesaj veya deneme hakkı test verisi yapılmadı.
Yeni teklif ayarları başlangıçta kapalıdır.

**Doğrulanmamış:** Şifreli yedeğin geri açılması, tam kurtarma provası ve Storage
fotoğraf baytlarının ayrı yedeği. Receipt'teki restoreDrillVerified=false
değiştirilmedi. Bu kayıt bunların yapılmış olduğunu iddia etmez.

## Kontroller

- Geçici sentetik PostgreSQL testi: başarılı.
- Arayüz ve oturum izolasyonu testleri: 7 test başarılı.
- Dar aday kaynak/normal ilan sözleşmesi/eski görünüm kontrolü: başarılı.
- Canlı public teklif kataloğu: HTTP 200, başlangıçta boş liste.
- Oturumsuz özel teklif verisi isteği: HTTP 401, erişim reddedildi.
- Canlı www HTML ve JS dosyaları: başarılı, teklif modülü sunuluyor.
- Canlı teklif sayfası görsel kontrolü: sayfa açılıyor, boş katalog durumu açık.

**Test sınırı:** Ayrı izinli gerçek Supabase alıcı/satıcı/üçüncü kişi test
hesaplarıyla kabul, ret, karşı teklif, anlaşma sonrası mesaj ve telefon akışının
uçtan uca doğrulaması yapılmadı. Sentetik testleri bu doğrulama yerine saymayın.
