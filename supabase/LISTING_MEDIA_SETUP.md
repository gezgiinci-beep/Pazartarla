# İlan galerisi ve vitrin geçişi — yeni yüklemeler için sunucu kurulumu etkin

Kullanıcının fotoğraf yükleme sunucu ayarını hemen etkinleştirme onayıyla,
`reviewed_changes/20261004_listing_media_expand.sql` canlı Supabase projesinde
transaction olarak uygulandı; COMMIT başarılı oldu. Kurulum sonrası
`gallery_paths text[]`, public `listing-media` bucket'ı, beş Storage erişim
politikası, etkin galeri trigger'ı ve genişletilmiş yönetici medya RPC'si
sunucu metadatasıyla doğrulandı. Daha önce kurulmuş owner-edit işlevleri korundu.

Bu aşama yalnız yeni yüklemeleri açar. Mevcut ilan/fotoğraf aktarımı,
SEO suffix temizliği, `finalize` aşaması veya yeni Vercel yayını yapılmadı.
Eski galeriler NULL olarak kalabilir ve mevcut uyumluluk okuyucusuyla okunur.
Kullanıcının önceki ek test/yedek provası durdurma talebi uyarınca yeni staging
provası veya canlı kullanıcı/fotoğraf fixture'ı oluşturulmadı; oturumlu gerçek
yükleme/indirme akışının uçtan uca başarı kanıtı olarak sunulmaz.
Tam kurtarma ve Storage-byte yedeği henüz doğrulanmış değildir.
`DATA_PROTECTION.md` önceliklidir; otomatik additive runner, uygulama açılışı
veya Vercel build bu SQL'i çalıştırmaz. Mevcut ilan/kullanıcı/rehber verileri
silinmez. Storage nesneleri silinmez, üstüne yazılmaz, yeniden sıkıştırılmaz.
Sonraki aktarım/finalize adımlarının ayrı izin ve koruma koşulları geçerlidir;
bu onay eski kayıtları taşımaya veya veri koruma kurallarını kalıcı olarak
kaldırmaya izin vermez.

## Yeni veri sözleşmesi

- `gallery_paths text[]`: sıralı `listing-media/<nesne-yolu>` referansları.
  Mevcut HTTPS fotoğraf adresleri aynı şekilde korunur.
- `is_featured boolean`: doğrudan sorgulanabilir vitrin bilgisi.
- `image`: eski tüketiciler için ilk fotoğrafın HTTPS adresi.
- `seotags`: yalnız SEO metni; eski metindeki boşluklar ve Türkçe karakterler korunur.
- Fotoğraf byte'ları Storage API ile `listing-media` bucket'ına yüklenir.
  Yeni fotoğraflar 2 MB, eski fotoğrafların kayıpsız taşınması en fazla 20 MB.
  JPEG/PNG/GIF/WebP dışındaki kaynaklar otomatik atılmaz; geçiş durur ve inceleme gerekir.
- Üye, veritabanında kendini vitrine alamaz. Storage yükleme yolu oturum sahibiyle
  sınırlı; overwrite/delete engellenir. Yönetici medya RPC'si eski snapshot'ı reddeder.

## Yayın sırası ve izin sınırları

1. Ayrı test ortamında sentetik kayıtlarla SQL, RLS, Storage yükleme/indirme,
   kullanıcı ve yönetici akışlarını doğrulayın. Yerel SQL testi gerçek Storage API
   entegrasyonunun yerine geçmez:
   `node --experimental-strip-types --test tests/listing-media.test.mjs tests/listing-media-plan.test.mjs`
   ve `node scripts/check-listing-media-local.mjs`.
2. İnceleme/onay, başarılı şifreli DB+kod yedeği ve ayrı ortamda kurtarma provası
   olmadan üretimde ilerlemeyin. Dosya byte'larının yedeği DB dump'a dahil değildir.
3. `reviewed_changes/20261004_owner_listing_edit.sql` sunucuda etkin olmalı.
   `20261004_listing_media_expand.sql` ayrıca incelenip açık onayla uygulanır.
   Bu aşama eski ilanları değiştirmez ve sütunlar NULL kalabilir.
4. Yeni frontend'i önce preview'da doğrulayın. Yeni yazmalar ayrı alanları kullanır,
   eski metadata sadece okunur. Sunucuda alanlar/RPC yoksa eski seotags yazımına
   geri dönüş **yoktur**, form hata verip taslağı korur.
5. Tüm aktif yazıcıları koordine edin. www ve ayrı apex aynı Supabase'i kullanabilir;
   eski bir frontend yeniden SEO suffix'i yazabilir. www-only izin apex'i değiştirme
   yetkisi vermez. Ana branch'i merge etmek de iki projeyi yayınlayabilir.
   Onaylanmayan projeyi değiştirmeyin; ilgili sahip geçişi koordine etmelidir.
6. Güvenli operatör ortamında mevcut `SUPABASE_DATABASE_URL`, resmi CA dosya yolu,
   yedek public key/dizini ve Storage API için `SUPABASE_SERVICE_ROLE_KEY` gereklidir.
   Credential chat'e, Git'e veya browser'a konmaz. Test API'sinde üretim anahtarı kullanılmaz.
7. `node scripts/migrate-listing-media.mjs --dry-run` salt okunur inceleme yapar.
   Bozuk metadata, desteklenmeyen URL/fotoğraf veya 10'dan fazla fotoğrafta durur.
   Günlük yalnız sayıları ve incelenen değişiklik hash'ini içerir.
8. Kod temiz ve commit edilmiş olmalı. Operatör açık onayla
   `PAZARTARLA_MEDIA_APPROVAL=production:<proje-ref>:<yazdırılan-hash>` ve tüm
   yazıcıları doğruladıktan sonra `PAZARTARLA_MEDIA_WRITERS_READY=verified` ayarlar.
   `node scripts/migrate-listing-media.mjs --apply` her seferinde yeni şifreli yedek alır.
9. Taşıyıcı her inline fotoğrafı deterministik yola yükler ve tekrar indirerek SHA-256
   byte eşleşmesini doğrular. **Bu kontrol başarılı olmadan suffix kaldırılmaz.**
   Satır kilitlenip orijinal snapshot karşılaştırılır; sadece dört medya/SEO sütunu
   yazılır. Diğer alanlar, ID, sahiplik, tarih, durum, fiyat korunur ve tekrar okunur.
   Yarışma/hata geçişi durdurur; önce biten satırlar güvenlidir. Tekrar çalıştırma
   doğrulanmış nesneleri kullanır. Belirsiz DB yanıtında nesneler silinmez.
10. `node scripts/migrate-listing-media.mjs --verify` tüm ilanlarda NULL/suffix/inline
    byte kalmadığını ve Storage fotoğraflarının indirilebildiğini doğrular. Eski HTTPS
    adreslerine istek atılmaz; değişmeden korunurlar.
11. Tüm aktif yazıcılar yeni sözleşmedeyken ve doğrulama başarılıyken
    `20261004_listing_media_finalize.sql` ayrı onayla uygulanır. Eksik satır varsa
    SQL durur; NULL ve inline/suffix yeniden yazılması kalıcı olarak engellenir.
12. Son canlı UI doğrulamasından sonra read-only legacy decoder çıkarılabilir.
    Geçiş kanıtı yokken kaldırmayın. İlanları/nesneleri silen “temizleme” çalıştırmayın.

**Açık işler:** Gerçek staging Storage/Auth doğrulaması, yedek/kurtarma hazırlığı,
üretim onayı, aktif frontendlerin koordinasyonu ve canlı backfill/doğrulama.