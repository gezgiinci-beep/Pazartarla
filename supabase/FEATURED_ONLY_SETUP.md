# Yalnız vitrin düzeltmesi — www'de uygulandı

Önceki canlı www sürümü, sunucuda bulunmayan `get_listing_for_edit` ve
`update_listing_media` işlemlerini çağırıyordu. Yönetici paneline giriş bu eksik
sunucu işlemlerini kurmaz. Vitrin düğmesi artık bağımsız
`get_listing_featured_snapshot` ve `set_listing_featured` işlemlerini kullanır.
Bu düzeltme fotoğraf geçişinden bağımsızdır.

`reviewed_changes/20261005_featured_only.sql` yalnız nullable `is_featured`
alanını ve dar, snapshot kontrollü yönetici işlemlerini ekler. Eski ilanlarda
backfill yapmaz. Fotoğraf byte'ları, galeri sırası, SEO suffix/prefix, onay durumu,
sahiplik ve diğer ilan alanları değişmez. Üye/anon doğrudan alan yazımı da
engellenir; yönetici kimliği güncel doğrulanmış Auth kaydından kontrol edilir.

Önce `DATA_PROTECTION.md` koşullarına göre yeni doğrulanmış şifreli DB+kod yedeği
alınmalıdır. Yedek şifreleme public anahtarı ve repo dışı yedek dizini eksikse
üretim SQL'i uygulanmaz. Private kurtarma anahtarı kullanıcıda güvenli kalır.

Kontroller:

```sh
node --test tests/listing-featured.test.mjs
node scripts/check-featured-local.mjs
pnpm run build
```

Yayın, güncel www deployment commit'inden açılan ayrı dalda sadece vitrin handler,
alanın okunması ve yardımcı modül değişikliklerinden oluşmalıdır. Yerel fotoğraf
geçişi veya diğer hazırlanmış özellikler topluca yayınlanmaz. Ana branch'e merge
edilmez; apex projesi değiştirilmez. SQL sonrası eski alanlar/kayıt sayıları
karşılaştırılır, yalnız www preview doğrulanıp onaylı www yayını yapılır.

## Doğrulanan canlı teslimat

- 5 Ekim 2026'da 4096 bitlik kullanıcı public anahtarı doğrulandı; repo dışında
  yeni şifreli tam DB ve kod yedeği alındı. Arşiv okunabilirliği ve şifreli
  dosya hash'leri doğrulandı. Private anahtar kullanıcıda kalır.
- SQL transaction'ında 21 korunan tablonun eski alan hash'leri ve kayıt sayıları
  değişmeden kaldı. İlan/fotoğraf/SEO backfill yapılmadı.
- Gerçek uygun yönetici kaydıyla yalnız salt okunur snapshot erişimi doğrulandı;
  anonim gerçek API erişimi `42501` ile reddedildi. Canlıya test kaydı veya
  vitrin test yazması yapılmadı. Ekle/kaldır, üye/anon ret ve eşzamanlı değişiklik
  kontrolleri sentetik yerel PostgreSQL ortamında geçti.
- www canlı kaynak commit'i üzerinden açılan `fix/www-featured-only-20261005`
  dalındaki `51d0b2871f64053e5965f799a46f3eb8635b69e5` yayımlandı.
  Yalnız vitrin handler/okuma, yardımcı modül, SQL ve ilgili test değişti.
  Ana branch'e merge edilmedi.
- www alias'ı `dpl_3VgyT6bJ8ARKUMHbmCEF6W2DmDsY` deployment'ına bağlı.
  Ayrı apex alias'ı işlem öncesi `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P`
  deployment'ında kaldı. www HTTP 200, canlı bundle'da iki yeni RPC ve alanın
  okunması, ayrıca halka açık sayfa görünümü doğrulandı.
- Preview promotion API'si 422 döndüğü için aynı commit www projesinde
  production hedefiyle ayrıca derlendi. Otomatik özel-domain ataması kapalı
  bırakıldı; yalnız `www.pazartarla.com.tr` alias'ı açıkça atandı.

**Tamamlanmayan ayrı kapsam:** Fotoğraf byte aktarımı, gallery_paths alanı,
SEO suffix temizliği ve final kısıtlar uygulanmadı. Tam kurtarma provası ve
Storage byte yedeği henüz doğrulanmadı; DB dump fotoğraf nesnelerini içermez.
Tam medya geçişi öncesinde featured-only guard ile yeni üye insert sözleşmesi
birlikte değerlendirilmelidir (bu guard üyenin non-NULL featured insert'ini reddeder).
