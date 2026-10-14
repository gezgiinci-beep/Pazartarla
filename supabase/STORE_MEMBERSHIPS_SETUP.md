# Mağaza paketleri — güvenli aktivasyon

## Canlı kurulum durumu — 2026-10-05

Kullanıcı mağaza başvurusunu canlıda etkinleştirmeyi açıkça onayladı.
`reviewed_changes/20261004_store_memberships.sql` hedef Supabase projesinde
uygulandı; özel paket/mağaza/başvuru/üyelik/ödeme tabloları ve sunucu işlevleri
oluşturuldu. Mevcut ilan, kullanıcı, fotoğraf ve gönderim geçmişini yeniden
yazan veya silen bir işlem çalıştırılmadı; hiçbir gerçek üyelik etkinleştirilmedi.

Anonim katalog cevabı, arayüzün gerçek `parseStoreData` sözleşmesiyle transaction
içinde doğrulandı. Özel tabloların RLS'i ve anonim başvuru yetkisinin kapalı
olması doğrulandı. Dosyanın sonundaki şema bildirimi, kurulum doğrulamasıyla
birlikte COMMIT öncesinde gönderildi; transaction başarıyla tamamlandı.
Ardından canlı PostgREST kataloğu da gerçek arayüz çağrısıyla iki paketi
başarıyla döndürdü; anonim cevaba özel başvuru/ödeme geçmişi dahil edilmedi.

Yeni Vercel frontend yayını gerekmedi: mevcut mağaza ekranı bu işlevleri çağırır.
Eski hata ekranındaki **Yeniden yükle** düğmesi paketleri formu sıfırlamadan
yeniden getirir. Paket seçimi ve doğrulanmış e-posta oturumu başvuru koşuludur.
Havale/EFT kontrolü ve yönetici onayı olmadan ücretli üyelik başlamaz.

Kullanıcının önceki ek prova/testleri durdurma isteği nedeniyle gerçek hesapla
başvuru/ödeme fixture'ı veya yeni kurtarma provası çalıştırılmadı. Tam kurtarma
ve Storage-byte yedeği doğrulanmış sayılmaz; oturumlu başvuru, yönetici ödeme
onayı ve yenilemenin uçtan uca başarı kanıtı ayrıca yoktur. Bu aktivasyon,
gelecekteki değişikliklerin koruma koşullarını kalıcı olarak kaldırmaz.

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
2. Doğrulanmış/moderasyonlu üyelik, yönetici muafiyeti, 12 takvim ayı sona erme ve
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