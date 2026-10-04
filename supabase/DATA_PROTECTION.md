# Veri koruma ve güvenli güncelleme

**Kalıcı kural:** Kod/şema güncellemeleri mevcut ilanları, kayıtlı kullanıcıları,
iletişim deposunu veya diğer gerçek verileri silmemeli, sıfırlamamalı ya da
test kayıtlarıyla karıştırmamalı. Bu belge eski kurulum/`--apply` talimatlarından
önceliklidir. Silme/geri yükleme ayrı ve açıkça onaylanmış bir bakım işlemidir;
normal geliştirme, yayın veya uygulama başlangıcı sırasında çalışmaz.

## Kurulan kontroller

- Tarihî migrasyonların SHA-256 değerleri sabitlendi. Eski dosyayı değiştirmek
  veya kaldırmak kontrolü başarısız yapar. Yeni değişiklik yeni dosyadır.
- Otomatik migrasyon izin listesi yalnızca nullable basit sütun ekleme, basit
  yeni tablo ve sütun bazlı indeks oluşturmayı kabul eder. DELETE/UPDATE/TRUNCATE,
  DROP, reset/seed, ALTER TYPE/rename, DEFAULT fonksiyonu, DO, veri kopyalama,
  fonksiyon/trigger/policy değişiklikleri gibi belirsiz işlemler **engellenir**.
  Gerekli karmaşık işler “güvenliymiş” gibi geçirilmez: ayrı inceleme, test ve
  onay gerekir. Baseline güncelleyerek bu kontrol aşılmamalıdır.
- Üretim yürütücüsü tarihî migrasyonu tekrar uygulamaz. Yeni dosyanın hash'i
  ve proje için açık onay, temiz kod commit'i, doğrulanmış TLS ve **yeni başarılı
  şifreli DB+kod yedeği** olmadan başlamaz. Kullanıcının yazdığı eski bir receipt
  dosyası yedek kontrolünün yerine geçmez.
- İşlem tek PostgreSQL transaction'ıdır. Önce korunacak public/private tablolar,
  auth.users/identities ve Storage metadata tabloları kilitlenir. Eski alanların
  sıralı SHA-256 özeti ve kayıt sayıları önce/sonra karşılaştırılır. Değişirse
  veya hata olursa ROLLBACK; başarıda dosya/hash/commit kaydı tutulur.
- Yeni tablolar RLS ile ve anon/authenticated doğrudan erişimi kapalı oluşturulur.
  Gerekli yeni erişim politikaları ayrı incelenmelidir.
- Kilit 5 saniyede alınamazsa işlem durur; sorgular 30 saniye ile sınırlıdır.
  Büyük tablolarda özetleme pahalı olabilir ve güvenli şekilde durabilir.
  Güncellemeyi düşük trafikte yapın; bu kısa bakım kilitleri yazmaları bekletebilir.
- Normal frontend build/publish ve uygulama açılışı SQL migrasyonu çalıştırmaz.
  GitHub `Data safety / data-safety` işi hiçbir veritabanı anahtarı almaz.

## Test–canlı ayrımı

Tüm `check-*-database.mjs` testleri üretim bağlantısı
`SUPABASE_DATABASE_URL`'i kullanmayı bıraktı. Üretim projesi test hedefi olarak
açıkça reddedilir; geri alınan test transaction'ı bile canlıda çalıştırılmaz.

1. Ayrı Supabase test projesi açın. **Canlı kullanıcı verisi kopyalamayın.**
   Testleri tamamen sentetik ilanlar/kişiler ve sentetik yönetici/üye hesaplarıyla
   hazırlayın. Auth hesapları test projesinin normal/admin Auth API'siyle oluşturulur.
2. Şema ve politikaları gözden geçirilmiş şema-only yöntemle test projesinde kurun;
   özel yönetici allowlist'ine yalnızca sentetik test yöneticisini ekleyin.
3. **Sadece test projesinde**, SQL Editor ile işaret ekleyin:

   ```sql
   CREATE TABLE private.environment_guard(
     singleton boolean PRIMARY KEY CHECK(singleton),
     environment text NOT NULL CHECK(environment='test')
   );
   ALTER TABLE private.environment_guard ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON private.environment_guard FROM PUBLIC,anon,authenticated;
   INSERT INTO private.environment_guard VALUES(true,'test');
   ```

4. Güvenli ortam değişkenlerinde `PAZARTARLA_TEST_DATABASE_URL`,
   `PAZARTARLA_TEST_PROJECT_REF`, `PAZARTARLA_TEST_DATABASE_CA_FILE` tanımlayın.
   Bağlantı hedefi ve açıkça belirtilen proje aynı olmalı. İşaret yoksa test durur.
5. `--apply`, `--seed`, `--reset` test komutlarında yasaktır. Testler normalde
   ROLLBACK ile biter. Şu anda test projesi yapılandırılmadığından DB fixture
   testlerinin durması **beklenen güvenlik davranışıdır**, canlıya dönüş yapılmaz.

Şifreli canlı yedeğinin kurtarma provası ayrı, erişimi kısıtlı bir kurtarma
ortamıdır; geliştirici/tester ortamına gerçek kişisel bilgiler aktarılmaz.

## Yedekleme: veritabanı + kod

`node scripts/backup-production.mjs` aynı kod commit'inin arşivini ve tam
PostgreSQL custom dump'ını alır. auth kullanıcıları, ilanlar ve iletişim
deposunun TABLE DATA girdileri `pg_restore --list` ile kontrol edilir.
Dump okuma başarısızsa başarı belgesi üretilmez. Bağlantı `verify-full` TLS ve
`default_transaction_read_only=on` kullanır; parola komut satırına/loga yazılmaz.

Her dosya AES-256-GCM ile şifrelenir; rastgele anahtar RSA-OAEP-SHA256 public
anahtarla sarılır. Geçici düz dump 0700 dizinde/0600 dosyada tutulur ve silinir.
Kalıcı çıktı sadece `database.dump.pzb`, `code.tar.pzb`, metadata receipt'idir.
Yedekler Git ağacında saklanamaz, tekrar yazılmaz ve içinde PII bulunan arşivler
Library'ye, commit'e veya normal loga eklenmez.

**Gerekli kurulum (henüz etkinleştirilmedi):**

0. GitHub bağlantısı normal kaynak dosyalarını yazabiliyor, ancak workflow
   dosyalarını yazmayı reddetti. Bu nedenle çalıştırılabilir örnekler
   `supabase/automation/data-safety.yml` ve `supabase/automation/encrypted-backup.yml`
   olarak saklandı. Workflow yazma yetkili repository sahibi, bunları aynı
   isimlerle `.github/workflows/` altına ekleyip incelemelidir.
   `supabase/automation/` altındaki dosyalar **kendiliğinden çalışmaz**.
1. Güvendiğiniz çevrimdışı bir makinede RSA anahtar çifti oluşturun:
   `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out recovery-private.pem`
   ve `openssl pkey -in recovery-private.pem -pubout -out backup-public.pem`.
   Private dosyayı erişimi kısıtlı, ayrıca yedekli bir parola kasasında tutun;
   dosya/parola chat'e, GitHub'a veya repoya eklenmez. Kaybolursa yedek açılamaz.
2. GitHub repository environment **database-backup** içinde bağlantıyı
   `SUPABASE_DATABASE_URL` **secret** olarak; yalnız public PEM'i
   `PAZARTARLA_BACKUP_PUBLIC_KEY` **variable** olarak tanımlayın.
   Secret'lar PR/test işlerine verilmez. Environment erişimini koruyun.
3. Günlük workflow ancak incelenip varsayılan branch'e alındıktan sonra,
   bu yapılandırma tamamlanınca çalışır. PR'a dosya eklemek otomasyonu etkinleştirmez.
   Vercel otomatik production yayınını ayrı onaylamadan branch merge etmeyin.
   Alternatif: temiz checkout'ta aynı komutu güvenli zamanlayıcıyla çalıştırın.
4. Workflow her gün **02:00 Türkiye saati** hedefler (GitHub çalışması gecikebilir),
   elle de tetiklenebilir; şifreli artifact 30 gün tutulur. Başarısız job için
   GitHub bildirimlerini açın ve her gün son başarılı işi/artifact'ı kontrol edin.
   “Workflow var” ≠ “yedek alındı”. Periyodik olarak şifreli kopyayı ayrı bir
   hesaba/sağlayıcıya indirin; GitHub hesabının kaybı tek kurtarma noktasını kaldırmamalı.
5. Yerel operatör için ayrıca `SUPABASE_DATABASE_CA_FILE` resmi CA yolunu ve
   `PAZARTARLA_BACKUP_DIRECTORY` repo dışındaki güvenli dizini gösterir.
   PostgreSQL client sürümü sunucu sürümünden eski olamaz; workflow client 18 kullanır.
   Proje yükselirse client da gözden geçirilir.

Receipt şifreli dosyaların SHA-256 değerlerini, kaynak proje/commit/zamanını tutar;
**archiveReadable** tam kurtarma testi değildir, **restoreDrillVerified=false**
olarak açıkça belirtilir. Backup job, uygulama kayıtlarını değiştirmez.

## Supabase hizmet yedekleri ve fotoğraflar

Resmi belgeye göre Pro/Team/Enterprise günlük DB yedekleri alır; Free için
düzenli dışa aktarma önerilir. PITR ayrı ücretli seçenek olabilir. Mevcut planın
ve yedeklerin etkinliği bu çalışmada doğrulanmadı; Dashboard → Database → Backups
bölümünde başarı tarihlerini kontrol edin. İhtiyaç varsa PITR'ı maliyeti/onayıyla
etkinleştirin. Günlük yedekler arasında oluşan veriler yine risk altındadır.

**DB yedeği Storage dosya baytlarını içermez.** İlan fotoğrafları için:
- Storage bucket'larını Storage/S3 uyumlu API üzerinden **yalnız kopyalama**
  ile ayrı sağlayıcı/hesaba düzenli ve önemli medya güncellemesinden önce aktarın.
- Sürüm geçmişini/retention'ı koruyun; `sync --delete`, bucket reset veya
  hedefteki önceki sürümleri silen aynalama kullanmayın.
- Bucket/object path/size/checksum envanteri, dosya kopyaları ve erişim ayarları
  birlikte korunmalı; KVKK gereği özel dosyalar özel ve şifreli tutulmalı.
- Restore provasında fotoğrafın kendisi indirilebiliyor mu kontrol edin;
  DB metadata varlığı bunu kanıtlamaz. Storage bytes otomasyonu bu DB/kod
  workflow'una dahil değildir; ayrı kopyalama talimatı uygulanmalıdır.

## Yeni güncelleme ve kurtarma akışı

1. Yeni ayrı migrasyon dosyası ekleyin, `node scripts/check-migration-safety.mjs`
   ve `node --test tests/data-safety.test.mjs` çalıştırın. Önce ayrı test projesi.
   PostgreSQL araçları mevcutsa `node scripts/check-preservation-local.mjs`
   tamamen geçici, dış bağlantısız bir cluster'da gerçek SQL ile ekleme/koruma
   ve DELETE/UPDATE/TRUNCATE algılama/rollback kontrolünü yapar.
2. Basit additive dosya için hash hesaplayın; güvenli operatör ortamında
   `PAZARTARLA_CHANGE_APPROVAL=production:<proje-ref>:<dosyanın-SHA256-değeri>` tanımlayın.
   `node scripts/migrate-safe.mjs YYYYMMDD_aciklama.sql` çalıştırın.
   Yürütücü yeni yedek almadan yazmaz. Yedek çıktılarını repo dışına kopyalayın.
3. Branch korumasında required `data-safety` kontrolünü ve code-owner review'ı
   etkinleştirin. Baseline/guard/workflow değişiklikleri özellikle incelensin;
   sahibi korumaları devre dışı bırakabilirse mutlak silinmezlik garantisi yoktur.
4. Karmaşık şema/data dönüşümü: normal otomatik yol **engeller**. Önce staging,
   orijinal kolonları koruyan expand/backfill yaklaşımı, batch kontrolü, başarılı
   yedek ve kurtarma provası; ayrıca kullanıcı onayı gerekir. Canlı reset/drop
   veya eski backup'ı canlıya doğrudan yazma çözüm değildir.
5. Ayda en az bir kurtarma provası yapın. Receipt'teki şifreli dosya hash'ini
   karşılaştırın; güvenli çevrimdışı makinede `PAZARTARLA_RECOVERY_PRIVATE_KEY_FILE`
   tanımlayarak `node scripts/decrypt-backup.mjs database.dump.pzb yeni-private.dump`
   çalıştırın. Bu araç mevcut dosyayı değiştirmez ve DB restore etmez.
6. Tam kurtarmayı ayrı, erişimi kısıtlı ortamda Supabase'in resmi restore/clone
   yöntemiyle deneyin: custom dump rol/managed-schema/extension uyumu ayrıca
   incelenmelidir; `pg_restore --clean` veya otomatik canlı restore kullanılmaz.
   Kullanıcı/ilan/rehber sayıları, giriş, RLS, ayarlar, izinler ve fotoğraflar
   doğrulandıktan sonra olay için ayrı canlı kurtarma onayı istenir.
   Eski backup restore etmek sonradan eklenen kayıtları kaybettirebilir.

Kaynaklar:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://www.postgresql.org/download/linux/ubuntu/

**Bu çalışma gerçek verileri silmedi/sıfırlamadı; canlıda test fixture çalıştırmadı.
Henüz gerçek şifreli yedek alınmadı, cron/branch protection etkinliği ve tam restore
doğrulanmadı. Bunlar kurulum akışının açık aktivasyon/kabul adımlarıdır.**