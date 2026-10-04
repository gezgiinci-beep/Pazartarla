# Mağaza paketleri — güvenli aktivasyon

## İş kuralı
- Paket 1: **350 TL/ay**, yeni gönderim **30**, aynı anda aktif ilan **100**.
- Paket 2: **500 TL/ay**, yeni gönderim **150**, aynı anda aktif ilan **250**.
- Dönem, yönetici onayından başlayıp İstanbul saatine göre bir takvim ayı sürer.
  Otomatik ödeme çekme/yenileme yoktur. Süre sonunda yeni talep, yeni banka
  ödemesi ve yeni yönetici onayı gerekir.
- Paketli üye günlük 3 ilan sınırından muaftır. Paket bitince günlük kayan kota
  devreye girer; eski gönderim geçmişi silinmez.
- Aktif kapasite için onay bekleyen ilanlar yer ayırır. Aylık kota tüm yeni
  gönderimleri sayar; ret/silme hakkı iade etmez. Mevcut ilanı düzeltmek yeni
  gönderim sayılmaz; kullanıcı düzeltmeleri yeniden onaya gider.
- Yönetici sınırsız ilan göndermeye devam eder. Üyelik, hiçbir ilanı otomatik
  onaylamaz veya ücretli VIP/vitrin statüsüne yükseltmez. Onaylı ilanlar mevcut
  genel ilan alanında ve üyenin mağazasında aynı kayıt/ID ile gösterilir.

## Yönetim
Üye, paket seçip mağaza adı/açıklamasıyla talep gönderir. Talep tek başına
üyelik açmaz. Yönetici “Mağaza Paketleri — Havale/EFT Onayları” ekranında gerçek
banka transferini kontrol eder; işlem referansı ve ayrı onayla bir dönem açar.
IBAN, kart/parola veya hesap bilgisi referans alanına girilmez. Aynı referans
iki üyelik açamaz; belirsiz yanıtı yeniden denemek süreyi uzatmaz.
Yönetici talebi reddedebilir. Kotalar ve fiyat talep anında sunucudaki paket
tanımından alınır; kullanıcı JSON'u ile hak/fiyat/hesap sahibi değiştirilemez.

Mağaza bağlantısı `?magaza=<mağaza UUID>` ile yenilemede ve ayrı tarayıcıda açılır.
Mağaza açıklaması sürüm kontrollüdür. Sahip bilgileri, özel e-posta, ödeme ve
başvuru geçmişi anonim mağaza cevabına dahil edilmez.

## Üretim öncesi zorunlu sıra
1. DATA_PROTECTION.md uyarınca doğrulanmış şifreli yedek, manifest ve geri
   yükleme provası. Gerçek üretim verisiyle test yoktur.
2. Doğrulanmış/moderasyonlu üyelik, yönetici muafiyeti, 8 ay sona erme ve
   owner-listing-edit altyapısı kurulmuş olmalı.
3. `reviewed_changes/20261004_store_memberships.sql` ayrıca incelenip ayrı
   kullanıcı onayı sonrası yetkili operatörce uygulanır. Tarihî migration
   hashleri/otomatik güvenlik allowlist'i değiştirilmez.
4. SQL, yeni özel tablolar/fonksiyonlar ve dar kota kontrolü ekler. Eski
   ilanları, üyeleri, iletişimleri, fotoğrafları veya gönderim geçmişini
   yeniden yazmaz, silmez, toplu arşivlemez. Paket kurulumu kapasiteyi aşan
   eski ilanları sessizce kaldırmaz; üyelik onayı açık hata verir.
5. Ayrı ortamda anonim/başka üye yetki reddi, ödeme mükerrerliği, son kota
   hakkına eşzamanlı gönderim, onayda aktif kapasite, düzenleme, süre sonu,
   yenileme ve veri korunması doğrulanır.
6. Sonra yalnız yetkili **www** Vercel projesinde frontend yayını yapılır.

Yalıtılmış doğrulama: `node scripts/check-membership-local.mjs`.
Yerel regresyon: `node --experimental-strip-types --test tests/*.test.mjs`.