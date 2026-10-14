# Özel teklifler — canlıya geçiş incelemesi

Bu özellik canlı Supabase'e otomatik kurulmaz. `20261005_private_listing_offers.sql` yalnız ayrı onayla uygulanacak aday SQL'dir. `DATA_PROTECTION.md` kuralları geçerlidir: bağımsız inceleme, doğrulanmış güncel şifreli yedek ve açık canlı SQL onayı gerekir. Vercel yayını da ayrı onaya tabidir; www kaynağı kullanılır, apex proje ve ortak main değiştirilmez.

## Veri ve erişim sınırı

- Mevcut ilan, kullanıcı, mağaza, kota ve fotoğraf kayıtları değiştirilmez. Üç yeni özel tablo ve altı RPC eklenir; tablolara anon/authenticated doğrudan erişemez.
- Her ilan ve mağaza ürünü ayrı ayrı katılır; ayar yoksa kapalıdır. Ayrı teklifli ilan oluşturma mevcut doğrulanmış hesap, kota ve yönetici onayı sürecinden geçer.
- Halka açık RPC yalnız teklife açık, onaylı ve süresi dolmamış ilan kimliklerini verir. İlan onayı ve ürün bazında katılım birbirinden ayrıdır.
- Özel RPC, kimliği `auth.uid()` ile belirler. Alıcı yalnız kendi tekliflerini, satıcı yalnız kendi ilanına gelen teklifleri görür. Başka alıcıların tutarları veya görüşmeleri paylaşılmaz.
- Tutar en fazla iki ondalık basamak; miktar 80, not 500, mesaj 1000 karakterdir. Doğrulanmış hesap gerekir. Alıcı için 24 saatte en fazla 10 teklif; aynı taraf için aynı görüşmede 24 saatte 50 mesaj sınırı vardır.
- Bekleyen teklif yalnız satıcı tarafından kabul/ret/karşı teklife çevrilir. Karşı teklifi yalnız ilgili alıcı kabul veya reddeder. Eşzamanlı durum değişiklikleri satır kilidiyle korunur.
- Teklif almayı kapatmak yeni teklifleri durdurur; eski görüşmeler korunur. İlan yayından kalkmış, süresi dolmuş veya yeniden onaya düşmüşse yeni kabul/karşı teklif engellenir; ret mümkündür. Kabul edilmiş görüşmelerde mesajlaşma devam eder.
- Alıcı telefonu teklif verirken alınır, görüşme kabul edilmeden RPC'de hiçbir tarafa verilmez. Kabul sonrası iki taraf için iletişim ve mesajlaşma açılır. Mevcut normal ilan sayfasındaki zaten açık satıcı telefonu değiştirilmez.
- Son 100 görüşme ve bu kişinin son 500 mesajı gösterilir; kayıtlar bu sınır nedeniyle silinmez. İlan kaldırılırsa anlaşma ve özel mesajlar korunur, kabul edilmiş görüşmede satıcının iletişim anlık görüntüsü kullanılabilir.
- İlan kaydedilip teklif ayarı başarısız olursa arayüz kısmi kaydı açıkça belirtir ve tekrar ilan göndermemeyi söyler.
- Ödeme, sipariş, teslimat ve mağaza geneli anahtar eklenmez.

## Gerçek kayıtlara dokunmadan doğrulama

```sh
node scripts/check-private-offers-local.mjs
node --test tests/private-offers.test.mjs
pnpm run build
```

İlk komut geçici UNIX-socket PostgreSQL'de yalnız sentetik kayıtlarla SQL'i çalıştırır; dış veritabanı adresi veya anahtar okumaz. Kurulumun ilan satırlarını değiştirmediğini, rol/yetki/gizlilik, ürün bazlı katılım, moderasyon, karşı teklif, kabul sonrası mesaj/telefon ve kota sınırlarını sınar.

Canlıya geçişten sonra, gerçek ilanları değiştirmeyen ve özel olarak ayrılmış test kayıtları/hesaplarıyla uçtan uca kontrol gerekir. Sentetik test veya başarılı derleme, canlı kurulumu yapılmış gibi sunulamaz.
