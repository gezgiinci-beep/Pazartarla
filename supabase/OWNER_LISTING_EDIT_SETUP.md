# İlan sahibi düzenlemesi

## Davranış
- “İlan Ver” bölümündeki kendi gönderimlerinde ve kendi ilan detayında
  **İlanı Düzenle / Güncelle** butonu bulunur.
- Sunucu doğrulanmış ilan sahibini veya mevcut yetkili yöneticiyi kontrol eder.
  Eski, sahibi olmayan kayıtlar otomatik olarak bir kullanıcıya atanmaz.
- Sahibin başlık/fiyat/kategori/alt kategori/konum/açıklama/satıcı/telefon
  değişikliği aynı ID üzerinde yapılır ve **pending** durumuna döner.
  Yeniden onaylanana kadar kamuya görünmez. Değişiklik olmayan kayıt aynı kalır.
- Yönetici düzenlemesi mevcut statüyü korur. Mevcut yönetici medya/vitrin
  araçları ayrıca korunur. Kullanıcı medya veya vitrin metadata'sını değiştiremez.
- İlk tarih/sekiz aylık süre/ID/sahip/kota korunur. Arşivdeki ilanı üye düzenleyemez;
  yönetici düzenleyebilir ama yayın süresini yenilemez.
- Güncel satırın SHA-256 token'ı kilit altında yeniden kontrol edilir.
  Eski taslak yeni bir değişikliği ezmez; hata formu kapatmaz.
- Yönetici onay/red işlemi kartta görülen **aynı snapshot token'ına** bağlıdır.
  Kullanıcı bekleyen ilanı değiştirirse eski karar reddedilir; güncel içerik
  yeniden incelenmelidir. Galeri/SEO kaydı da açılış snapshot'ına bağlıdır
  ve yalnız `image`/`seotags` alanlarını yazar; metin/fiyatı değiştirmez.

## Etkinleştirme — canlıda henüz uygulanmadı

DATA_PROTECTION.md geçerlidir. Otomatik additive kontrolü gevşetmeyin veya
tarihî migration baseline'ını değiştirmeyin. Yetki fonksiyonları basit sütun
eklemekten farklı olduğundan dosya **reviewed_changes/** altında tutulur:
`20261004_owner_listing_edit.sql`.

1. Ayrı test projesinde inceleyin veya tamamen sentetik, geçici PostgreSQL
   kontrolünü çalıştırın: `node scripts/check-owner-edit-local.mjs`.
2. Başarılı şifreli DB+kod yedeği ve güvenli kurtarma akışı hazır olmadan
   canlıda SQL çalıştırmayın. Yedek altyapısının aktivasyon adımları önce tamamlanır.
3. Kullanıcı üretim yetki değişikliğini ayrıca onayladıktan sonra yetkili
   operatör dosyayı Supabase SQL Editor'de transaction olarak uygular.
   Fonksiyon sahipliği güvenilir DB yöneticisi olmalı; authenticated/anon
   fonksiyon sahibi olamaz. search_path kapalıdır; public EXECUTE yetkisi kaldırılır.
4. Uygulama mevcut admin-only doğrudan UPDATE/DELETE politikalarını **gevşetmez**.
   Üyeler yalnızca alan izin listeli RPC'yi çağırır; bilinmeyen eski politikalar
   zaten mevcut restrictive yönetici guard'ı ile sınırlıdır.
5. Başka hesap, anonim, eski token, yanlış kategori ve korunmuş alan yazma
   reddini ayrı test ortamında doğrulayın; ardından kod için ayrı yayın onayı.
   SQL uygulanmamışsa arayüz “sunucuda henüz etkinleştirilmemiş” hatasını gösterir,
   yerel sahte başarı veya yetkisiz doğrudan PATCH geri dönüşü yapmaz.
   Aynı dosyadaki `get_listing_moderation_queue`, `moderate_listing_snapshot` ve
   `update_listing_media` RPC'leri de birlikte uygulanmalıdır. Yeni frontend,
   eski koşulsuz moderation/gallery PATCH yoluna geri dönmez.

SQL kurulumu mevcut ilan kayıtlarını güncellemez/silmez. Testler gerçek
kullanıcı/ilanlar üzerinde çalıştırılmaz.