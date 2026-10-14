# Yönetici girişi ve ilk tıklamada vitrin güncellemesi

5 Ekim 2026'da www'deki gerçek vitrin düzeltmesi kaynak dalından ayrı bir
güncelleme hazırlandı. GitHub PR #5 yalnız `src/App.tsx`,
`src/lib/adminUiState.mjs` ve `tests/admin-ui-state.test.mjs` dosyalarını değiştirir.
Yerel fotoğraf geçişinin farklı App sürümü topluca gönderilmedi.

- Kayıtlı Supabase oturumu, yeni açılan sayfada paneli otomatik açmaz.
  Açık yönetici girişi, güncel sunucu yetki kontrolü ve aynı hesap oturumu gerekir.
- Çıkışta panel hemen kilitlenir; geç dönen yetki yanıtı paneli yeniden açamaz.
- Sunucudaki RLS/özel yönetici listesi korunur. UI giriş koşulu mevcut Auth
  tokenlarını iptal etmez; ortak bilgisayarda hesaptan çıkış yapılmalıdır.
- Vitrin isteği sürerken ikinci tıklama engellenir ve kaydetme durumu gösterilir.
- Yazmadan önce başlayan eski liste yanıtları kaydedilen vitrin durumunu
  değiştiremez; işlem sırasında yeni liste okuması başlatılmaz.
- Başarılı kayıttan sonra da eski değer taşıyan yanıtlar gelirse yalnız vitrin
  alanı doğrulanan son değerle gösterilir. Liste aynı değeri doğruladığında veya
  en çok 60 saniye sonra bu koruma kalkar; diğer yönetici değişiklikleri kalıcı
  olarak gizlenmez. Fotoğraf/SEO alanlarına bu geçici koruma uygulanmaz.
- SQL, ilan/fotoğraf/SEO kayıtları, apex ayarları ve canlı domain aliasları
  değiştirilmedi. Son PR önizlemesi READY; sekiz ilgili test ve üretim derlemesi
  başarılıdır.

Tarayıcı kontrolü sentetik, ağ istekleri yakalanan oturumlarla yapıldı: ilk
tıklamada kayıt, kayıt öncesi/sonrası eski yanıtlar, çift tıklama engeli, tek
tıklamada kaldırma, çıkış sonrası geç yetki yanıtları ve normal üyenin reddi
doğrulandı. Gerçek kullanıcı bilgileri, veritabanı yazmaları veya fotoğraf
işlemleri kullanılmadı. Ayrı temiz tarayıcı oturumunda canlı www paneli giriş
formunu gösterdi; canlı salt okunur `is_listing_admin` isteği `false` döndü.
Gerçek yönetici parolasıyla canlı giriş/yazma testi yapılmış sayılmaz.

Bu hazırlık canlı teslimat değildir. Yayından önce güncel www kaynağı ve aliasları
yeniden doğrulanmalıdır. Önbellek yayın çalışmasıyla birlikte değerlendirilmeli;
eski bir App dosyası yayımlanarak bu düzeltmeler geri alınmamalıdır.
