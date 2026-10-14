# Üyelik ve ücretsiz deneme — www yayın adayı

## Kullanıcının seçtiği kapanış kapsamı

Önceki çalışma yalnız hazır yayın adayıyla sınırlıydı. Kullanıcının sonraki
talebi yıllık paket, deneme ve diğer güncellemelerin veritabanı/sunucu
kurulumunu da tamamlayarak projeyi canlıya hazır hale getirmektir.
Bu genişletilmiş kapsam, aşağıdaki kurtarma ve veri koruma kontrollerinin
gerçekten yapılmış olduğu anlamına gelmez. Kontroller tamamlanmadan kurulum
ve canlı kabul testleri başarılı sayılmaz; son yayını kullanıcı başlatır.

## Kapsam ve güncel canlı kaynak

5 Ekim 2026 salt-okuma Vercel/GitHub kontrolü:

- www: `pazartarla-1`, `prj_xwZdAj65kkZnuPFtxNJpFKo5urO0`,
  `https://www.pazartarla.com.tr`, `dpl_EV87aQH9BeD3dpmQmgMysBkh2F4G`.
- Kaynak: `fix/www-store-panel-login-20261005`,
  `858f0f161da3c782410a0249687632c6fd556afd`.
- Ayrı apex: `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P`,
  `0180939e982f64967978c810b2613ba66db644b4`.
- www ve apex projelerinde otomatik özel alan adı ataması kapalıdır.
  Diğer bağlı projeler main'i otomatik yayımlayabilir: main'e merge yoktur.

Bu kayıt tarihî bir baseline'dır, gelecekte yayın öncesi tekrar okunmalıdır.
Hazırlık canlı SQL veya yayın izni değildir.

## Tekrar üretilebilir dar aday

Doğrulanmış canlı commit'in ayrı temiz checkout'unda:

```sh
node scripts/prepare-membership-release.mjs /path/to/separate-clean-www-checkout
```

Script geliştirme App'ini kopyalamaz. Canlı App'e yalnız dört değişiklik ekler:
tanıtım import'u, tercih state'i, başvuru sayfasına tercih prop'u ve ana sayfa
deneme tanıtımı. Çapa değişmişse/iki kez varsa durur. Yalnız izin listeli üyelik
dosyaları, iki SQL adayı, açıklamaları ve sentetik testleri taşır.
İlan düzenleme, mevcut oturum/giriş korumaları, öne çıkarma, storefront, bağımlılıklar,
önbellek sürümü ve Vercel ayarları canlı sürümden korunur.
Özel teklif kodu veya SQL'i taşınmaz. SQL dosyalarını repoya koymak onları çalıştırmaz.

Paketi yükleyemeyen sistem fail-closed kalır. V3 yalnız HTTP 404/PGRST202'de V2'ye,
V2 aynı hata türünde V1'e döner. Yetki, ağ ve veri hataları fallback ile gizlenmez.
Yıllık/deneme seçenekleri sunucu kataloğunda yoksa seçilemez.

## Canlı aktivasyon: tamamlandı; geri yükleme provası kullanıcı onayıyla atlandı

5 Ekim 2026 tarihinde resmî Studio yapılandırmasının gösterdiği kaynaktan
eksik CA geri alındı; sertifika doğrulaması açık tutularak canlı veritabanına
salt-okuma bağlantısı başarıyla yapıldı. Üyelik temeli ve iki aylık plan
mevcut; yıllık/deneme kurulu değil. İnceleme raporu:
`.local/releases/www-store-packages/database-preflight.json`.

Repo dışında yeni şifreli DB+kod arşivi ve hash receipt'i oluşturuldu.
Arşiv okunabilirlik kontrolü geçti; receipt başarılı kurtarma provası
bildirmiyor ve Storage fotoğraf baytlarını kapsamıyor. Şifreleme için
yapılandırılmış public anahtar kullanıldı; özel anahtar talep edilmedi.
Yeni arşiv oluşturmak, özel anahtarla açılıp izole ortamda başarıyla
geri yüklenebildiğini kanıtlamaz. Kullanıcı daha sonra açıkça özel anahtarla
geri yükleme provasını atlamayı ve iki yükseltmeyi canlıda etkinleştirmeyi
istedi. Bu talep yalnız bu aktivasyon için kaydedildi; genel güvenlik
kontrolleri kaldırılmadı. Uygulama öncesinde ayrıca taze şifreli yedek alındı.

İki incelenmiş SQL, tek transaction içinde uygulandı. Önce/sonra karşılaştırmada
29 tablodaki tüm eski satırlar ve eski sütun değerleri korundu; katalogda yalnız
iki yeni seçenek eklendi. Anonim SQL/API gizlilik kontrolleri geçti. Canlı API
V1/V2/V3 katalogları sırasıyla iki/üç/dört seçeneği HTTP 200 ile döndürüyor.
Anonim deneme aktivasyonu HTTP 401 ile reddedildi.

**Geri yükleme provası yapılmadı; başarılı olarak işaretlenmedi.**
Kontrollü aktivasyon ve canlı API raporları:
`.local/releases/www-store-packages/activation-result.json` ve
`.local/releases/www-store-packages/live-api-verification.json`.
Son Vercel yayını bu veritabanı işleminde yapılmadı.
Özel anahtar bu çalışma ortamına veya sohbete gönderilmez.

### Aktivasyon öncesi zorunlu sıra

Aşağıdaki süreç gelecekteki değişiklikler için geçerlidir. Bu aktivasyonda
yalnız geri yükleme provası için kullanıcının açık, tek seferlik feragati
vardır; bu feragat gelecekteki SQL/yayın işlemlerine otomatik taşınmaz.

1. Yetkili operatör erişilebilir şifreli DB+kod yedeğini ve hash receipt'ini,
   özel/izole ortamda başarılı DB kurtarma provasını doğrular. İlgili mevcut
   fotoğrafların Storage üzerinden erişilebilirliğini de doğrular; DB dump'ı
   fotoğraf baytlarını içermez. Yedeğin kapsamı ve tarihi değişiklik öncesi
   kurtarmaya uygun olmalıdır.
2. Resmî CA ile doğrulanmış TLS üzerinden yalnız katalog okumaları yap:
   mevcut Auth/doğrulanmış üye/RLS, kota, tarih ve featured trigger gövdeleri,
   izinleri ve üyelik ön koşullarını kontrol et. Eksik fonksiyon varsa
   ayrı değişiklik kapsamı/onayı olmadan kurma.
3. Üyelik temeli `20261004_store_memberships.sql`, sonra
   `20261005_annual_unlimited_store_plan.sql`, sonra
   `20261005_free_store_trial.sql`. Temel kurulum gerekip gerekmediğini canlı
   katalogdan yeniden belirle; tarihî migration'ları topluca çalıştırma.
   Mevcut üyelik kurulmuşsa temel SQL'i upgrade'lerden sonra tekrar çalıştırma.
   Owner-edit dosyası yalnız bağımlılıkları incelenip ayrıca onaylandıysa uygulanır.
4. Her uygulanacak SQL'in SHA-256 hash'ini, kapsamını ve bağımlılıklarını kullanıcıya
   sun; **ayrı açık canlı-SQL onayını** al. Hazırlık izni yeterli değildir.
5. Yetkili operatör kontrollü transaction'da mevcut ilanlar/orijinal tarihler,
   fotoğraf referansları, kişiler, ödeme ve üyelik snapshot'ları için önce/sonra
   koruma kontrollerini kilit altında yapar. Uyuşmazlıkta rollback.
   Dosyadaki BEGIN/COMMIT tek başına bu korumayı sağlamaz.
6. PostgREST şema önbelleğini yenile. Anonim katalog V1/V2/V3, özel verilerin
   anonimden gizlenmesi, doğrulanmamış reddi ve gerçek Auth/API/RLS akışları ayrı
   test ortamında sentetik hesaplarla doğrulanır; canlı kullanıcı/ilan değiştirilmez.

### Ürün kabul ölçütleri

- Paket 1: 350 TL/ay, 30 yeni ilan, 100 aktif. Paket 2: 500 TL/ay, 150/250.
- Paket 3: 2.500 TL/yıl; gerçek NULL sınırsızlık; ödeme onayından bir takvim yılı.
- Deneme: doğrulanmış sahibin mağaza başvurusundan tam 30 gün; sınırsız;
  banka transferi/üyelik yönetici onayı/otomatik tahsilat yok.
- Özel kalıcı tek-kullanım ledger'ı süre sonu, yarış, retry, farklı request ID
  ve ücretli geçişle sıfırlanmaz. Aynı retry süreyi uzatmaz.
- Sonraki ücretli onay trial_days'i temizler, ledger ve eski snapshot korunur.
- Normal ilan yönetici onayı, sahiplik, orijinal tarih ve sekiz takvim ayı korunur.
  Süre bitince normal kota geri gelir; ilan/fotoğraf/mağaza silinmez.
- V1 iki aylık, V2 üç ücretli, V3 dört seçenek; eski istemci yıllık/denemeyi
  aylık ödeme zannetmez. Güncel arayüz yıllık/deneme kotasını admin yetkisi saymaz.

## Doğrulama ve yayın devri

```sh
node --experimental-strip-types --test tests/free-store-trial.test.mjs tests/annual-store-plan.test.mjs tests/membership-access.test.mjs tests/membership-release.test.mjs
node scripts/check-annual-store-plan-local.mjs
pnpm run build
```

Yerel PostgreSQL testi dış kimlik bilgilerini kullanmaz; yalnız geçici socket ve
sentetik veriler kullanır. Bu, gerçek Supabase Auth/API kabul testi değildir.
Tam Git ağacı mevcut www commit'iyle karşılaştırılmalı; izin listesi dışındaki
hiçbir blob değişmemeli. Üç noktalı PR karşılaştırması bunun yerine geçmez.

Son Vercel build/yayın/promotion adımını yalnız kullanıcı başlatır. Önce kaynak
commit, hedef www projesi, iki alias baseline'ı ve SQL/API kabulü yeniden
doğrulanır. Main'e merge, apex değişikliği, domain ayarı değişikliği ve otomatik
yayını açma bu kapsamda değildir. Sonrasında www'nin beklenen commit'i sunduğu
ve apex'in aynı kaldığı salt-okuma ile doğrulanır.
