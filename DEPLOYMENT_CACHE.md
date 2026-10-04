# Sürüm ve önbellek

- HTML, SPA adresleri, `/version.json`, API yanıtları ve hash taşımayan dosyalar
  `no-store` kullanır. Yeni sayfa açılışları eski HTML'i önbellekten kullanmaz.
- Vite'ın hash içeren `/assets/` dosyaları bir yıl `immutable` saklanır.
  İçerik değişince dosya adı da değişir; bütün dosyaların önbelleğini kapatmak gerekmez.
- Mevcut Vercel `routes` yapısı korunur. Üst düzey `headers` ile karıştırılmaz.
  Önce genel saklamama kuralı, sonra yalnız hash'li asset istisnası uygulanır.
- Her build aynı kimliği HTML'deki `pazartarla-build-id` meta etiketine, JS'e ve
  `version.json` içine yazar. Kimlik commit SHA'sı ve build zamanından oluşur;
  aynı commit ortam ayarı için yeniden derlense de kimlik değişir.
  Yalnız public commit/zaman/dosya adları yayınlanır; env anahtarları yayınlanmaz.
- Açık sayfa odaklanınca, görünür olunca ve görünürken 60 saniyede bir sürümü
  kontrol eder. Yeni sürüm veya yüklenemeyen eski chunk için yenileme düğmesi çıkar.
  Otomatik reload yoktur: kaydedilmemiş ilan/yönetici formları korunmalıdır.
  Eski, bu kontrolü içermeyen açık sekmeler kendiliğinden bu davranışı kazanmaz.
- Yeni cache kuralları geçmişte saklanmış eski yanıtların başlıklarını geriye
  dönük değiştirmez. Gerekirse eski sekmede bir kez tam yenileme yapılır.
  Kullanıcı oturumları, localStorage ve yüklenmiş fotoğraflar topluca silinmez.

## Doğrulama

Build sonrası `dist/index.html` meta kimliği ile `dist/version.json` kimliği aynı
olmalı. Sürüm JSON'u build zamanını ve hash'li çıktı adlarını içerir.
Vercel'de ilgili deployment'a erişebilen kullanıcı, Network bölümünde HTML ve
sürüm JSON'u için `Cache-Control: no-store, max-age=0`, hash'li JS/CSS için
`public, max-age=31536000, immutable` başlıklarını kontrol edebilir.

**Yayın sınırı:** Önbellek ayarı deployment'ı canlı alan adına atamaz.
İki projedeki otomatik canlı alan adı ataması kapalı kalır. Hazırlanan sürümün
canlıya geçişi, Supabase hazırlığı tamamlandıktan sonra ayrı bir sahip işlemidir.