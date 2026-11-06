# Onaylı otomatik haber taslakları

## Durum ve kapsam

Kod, zamanlayıcı, taslak kuyruğu ve testler hazırlanmıştır. Çalışma alanına dosya
eklemek GitHub'da zamanlamayı veya canlı Vercel API'sini etkinleştirmez.
Gemini anahtarı güvenli biçimde GitHub'ın `gazette-automation` ortamına
aktarılmıştır. Bu, zamanlayıcının veya canlı taslak API'sinin yayımlandığı
anlamına gelmez. Gerçek model çıktısı ve canlı taslak oluşturma ayrı doğrulanır.

Sadece haber tablosuna yazılır. İlan tablolarına erişilmez. Her kayıt `haber`,
`draft`, `published_at = NULL` olarak oluşturulur; otomasyon yayınlama yetkisine
sahip değildir. Mevcut yönetici oturumu ve yetki kontrolleri aynen korunur.
Yönetici “Taslak Haberler” bölümünden kaynak ve kapak görselini inceler; mevcut
Yayımla işlemi ve ek editoryal onay sorusu ile yayına alır.

## Kaynak ve görsel hakkı

Kaynaklar `scripts/news/sources.json` içinde açıkça sınırlandırılmıştır:

- Tarım ve Orman Bakanlığı haberleri; TKDK haberleri ve destek duyuruları.
- İlk yerel kaynaklar: İzmir ve Tekirdağ büyükşehir belediyeleri, Nilüfer
  Belediyesi, Bolu ve Akdeniz ziraat odaları. Balıkesir tarafında Balıkesir
  Büyükşehir Belediyesi, **Balıkesir Gönen Belediyesi**, Balıkesir İl Tarım ve
  Orman Müdürlüğü ile Gönen Ticaret Odasının tarımsal haber/duyuruları izlenir.
  Gönen Ticaret Odası, Ziraat Odası olarak adlandırılmaz. Gönen Ziraat Odasına
  ait erişilebilir resmî web akışı henüz doğrulanmadığı için bir adres
  uydurularak eklenmemiştir. Bu başlangıç listesi Türkiye'deki
  bütün belediyeleri/odaları kapsadığı anlamına gelmez. Başka bir kurum ancak
  resmî adresi, tarih/içerik ayrıştırması ve güvenli URL sınırları doğrulanınca
  eklenir. Tarihi eski veya tarımsal olmayan sayfa taslağa alınmaz.
- USDA Agricultural Research Service araştırma haberleri. Bu **ABD kaynaklı**
  haberler Türkiye haberi, yerli hibe veya burada açık destek gibi sunulamaz.
Resmî telif bildirimi: https://www.ars.usda.gov/oc/images/copyright/

USDA'da yalnız ARS kaynak fotoğrafı olduğu açıkça belirtilen, üçüncü taraf telif işareti
olmayan görseller kullanılır. Metin ve fotoğrafın her ikisi de uygun değilse
kayıt atlanır; rastgele fotoğraf veya sahte haber üretilmez.
Kaynak adresi, kaynak tarihi, görsel künyesi ve yapay zekâ kullanımı taslakta
saklanır. Orijinal fotoğraf Blob'a güvenli JPEG olarak aktarılır; başka sitenin
sunucusuna sürekli hotlink verilmez. Küçük fotoğraf yapay olarak 1200px'e büyütülmez.
Bu otomatik kontroller insan editörün kullanım hakkı ve doğruluk denetiminin
yerini almaz. Kaynağın sonradan değişen koşulları ayrıca değerlendirilmelidir.

Türk resmî ve yerel kaynaklarda kurum fotoğrafları, logoları, ek dosyaları veya
tam metinleri kopyalanmaz. Kısa olgusal özet, kaynak bağlantısı ve kaynak tarihi
saklanır. Sunucu PazarTarla'nın kendi 1200×675 JPEG bilgilendirme kapağını üretir;
üzerinde “TEMSİLİ KAPAK · KAYNAK FOTOĞRAFI DEĞİLDİR” yazar. Bu yöntem fotoğrafı
kopyalama riskini azaltır; bütün telif ve doğruluk sorunlarını çözme garantisi
değildir. Son kullanım hakkı ve içerik kontrolü editördedir.

Yerel kaynaklarda tarım/hayvancılık/üretici destekleri dışındaki belediye ve oda
haberleri ayıklanır. Kurumun il/ilçesi editör notuna eklenir; bu bilgi otomatik
yararlanma sınırı değildir. Geçmiş duyurudan bugünkü başvurunun açık olduğu
çıkarılmaz; süre ve koşullar editörce kaynakta doğrulanır. Başlık, kaynak tarihi
ve yeterli metin bulunmazsa haber/görsel uydurmak yerine kayıt atlanır.

Hayvancılıkta büyükbaş/küçükbaş, süt, damızlık, yem, mera ve yetiştirici
destekleri dahildir; sokak hayvanı/pet belediye haberleri bu kapsama girmez.
Tarım/hayvancılık fuarları ile hal/toptan meyve-sebze resmî duyuruları da
haber taslağıdır. Eski fuar yaklaşan etkinlik, eski hal fiyatı bugünkü fiyat
gibi sunulmaz. Günlük fiyat tablosu kazınarak anlık fiyat hizmeti oluşturulmaz.

Kaynaklar 12 saatlik dilimlerde dönen bir sırayla iç içe işlenir; tek bir akış
bütün taslak yerlerini sürekli tüketmez. Çalışma başına üç, günlük toplam altı
taslak sınırı değişmez. Daha çok kaynak, her haberi veya her gün altı haberi
garanti etmez. `--check-sources` yapay zekâ ve veritabanı yazımı olmadan tarar.
Yeni kaynak eklemek için `scripts/news/sources.json`, izin belgesi, parser ve
sunucu doğrulaması birlikte gözden geçirilmelidir; herhangi bir RSS adresini
eklemek tam metni/fotoğrafları yeniden yayımlama izni vermez.

## Yapay zekâ

`fetch_news.py` doğrudan Google Gemini Developer API'sinde `gemini-3.5-flash-lite`
kullanır. Google'ın 6 Kasım 2026'da kontrol edilen fiyatlandırma belgesinde bu
modelin ücretsiz giriş/çıkış katmanı vardır:
https://ai.google.dev/gemini-api/docs/pricing

Kısa haber özetleri için hafif Flash-Lite modeli sabitlenmiştir; çalışma sırasında
başka modele otomatik geçiş yoktur. Sayısal iddialar kaynağın dili ve Türkçe
yazımın binlik/ondalık farkları gözetilerek karşılaştırılır; değer yuvarlanmaz.

Kullanıcının isteği: **yalnız ücretsiz katman, OpenAI ve ücretli sağlayıcı yok.**
Bu yüzden Google AI Studio'dan **Free** durumundaki, ücretli faturalandırmaya
bağlanmamış bir projeye ait anahtar gerekir. Anahtar oluşturma sayfası:
https://aistudio.google.com/api-keys
Bazı projeler ücretsiz kullanım için Google doğrulaması isteyebilir.

REST çağrısı projenin Free/Paid durumunu seçemez veya anahtardan okuyamaz.
Faturalandırması açık bir projenin anahtarı verilirse aynı model ücretli
tarifeye tabi olabilir; kodun tek başına sıfır ücret garantisi yoktur.
Otomasyon faturalandırmayı açmaz, kredi satın almaz, ücretli modele/sağlayıcıya
geçmez. Kota/auth/model erişimi hatasında çalışma durur; 429'a agresif tekrar
yapılmaz. 5xx geçici hatalarda aynı modele en fazla iki sınırlı tekrar yapılır.
Google Search grounding, ücretli araçlar ve batch/priority servisi kullanılmaz.
Google ücretsiz katmanda gönderilen içerikleri ürünlerini geliştirmek için
kullanabilir; yalnız kamuya açık haber metinleri gönderilir.
GitHub Models kullanılmaz: resmî belgesine göre servis 30 Temmuz 2026'da kapandı.
Replit AI proxy anahtarı GitHub'a/Vercel'e kopyalanmaz; Replit kredisiyle çalışan
Gemini proxy entegrasyonu bu ücretsiz-katman kurulumunda kullanılmaz.

Yalnız kaynak metni gönderilir; kullanıcı, ilan veya müşteri bilgisi gönderilmez.
Prompt `scripts/news/editorial-prompt.txt` içindedir. Dış içerikteki talimatlar
güvenilmez veri sayılır. Çıktı JSON şeması, uzunluklar, HTML/bağlantı yasağı,
desteksiz rakamlar ve aşırı benzerlik açısından denetlenir. Bu kontroller
“tam özgünlük”, Discover uygunluğu, indeksleme veya görünürlük garantisi değildir.
Kesilmiş/başarısız model çıktısı taslağa dönüşmez. Yalnız 5xx geçici model
hatalarında önce 5, ardından 10 saniye beklenir; toplam en fazla üç çağrı yapılır.
Her yeniden denemenin yalnız HTTP kodu ve bekleme süresi günlüğe yazılır.
Yanıt gövdesi ve anahtar yazılmaz. 429'da yeniden denenmez; iş durur.

## Kimlik ve sırlar

GitHub Environment adı: `gazette-automation`.
Gerekli tek kullanıcı sırrı: `PAZARTARLA_NEWS_GEMINI_API_KEY`.
Eski OpenAI anahtarı okunmaz veya alternatif olarak kullanılmaz.
Anahtar sadece güvenli Secrets formundan alınır; sohbet, dosya, rapor veya loga
yazılmaz. GitHub secret'a aktarım GitHub'ın repository/environment public key
sealed-box şifrelemesiyle yapılmalıdır; açık değer saklanmaz veya çıktılanmaz.

Siteye bağlantı için yeni paylaşılan API şifresi veya Turso token'ı gerekmez.
Actions `id-token: write` izniyle kısa ömürlü OIDC token ister. Sunucu GitHub'ın
RS256 imzasını, süreyi, audience'ı, repository id'sini, `main` dalını, tam
workflow kimliğini, GitHub-hosted runner'ı ve event türünü doğrular.
Fork, PR, başka dal/workflow token'ı kabul edilmez. Bot normal admin girişini
taklit etmez; kullanıcı hesabı yaratılmaz.

## Zamanlama ve sınırlar

`.github/workflows/fetch-news.yml`: her gün 05:25 ve 17:25 UTC (İstanbul 08:25 ve
20:25); GitHub yoğunluk nedeniyle zamanlamayı geciktirebilir.
En çok 3 yeni taslak/çalıştırma, sunucuda toplam 6/son 24 saat.
`workflow_dispatch` ile elle çalıştırılabilir, yine aynı sınırlar uygulanır.
Repo değişkeni `PAZARTARLA_NEWS_AUTOMATION_ENABLED` tam olarak `true` olmadıkça
iş çalışmaz. Bu kapı ancak www'de doğrulanmış canlı API hazır olduktan sonra açılır.
Actions schedule yalnız varsayılan dalda etkinleşir; bir PR/feature dalına
yüklenmiş workflow “çalışan zamanlayıcı” değildir.
Bir haber silinse/yayımdan kaldırılsa bile import günlüğü kaldığından yeniden
eklenmez. Belirsiz bir veritabanı hatasında medya silinmez: işlem commit olmuş
olabilir. Nadir yarım kalan işlerden doğan sahipsiz Blob dosyaları otomatik
silinmez; güvenli bakımda referansları kontrol ederek ele alınmalıdır.
Actions başarısızlığı açık kırmızı iş sonucu üretir; otomatik e-posta/WhatsApp
bildirimi bu kurulumun parçası değildir.

## Etkinleştirme sırası

1. Anahtarı güvenli formdan al; yalnız `gazette-automation` ortamına şifreli aktar.
2. GitHub Environment'ı sadece `main` dalına sınırla. GitHub App'in workflow
   yazma yetkisini gerçek API yanıtıyla doğrula; repo yazma izni yeterli değildir.
3. Mevcut www canlı kaynağından dar aday oluştur. Diğer Vercel projelerinin
   otomatik build fan-out'unu kontrol etmeden ortak dala push/merge yapma.
4. Mevcut güvenli yedek ve kurtarma kurallarından sonra yalnız eklemeli
   `0018_gazette_imports.sql` geçişini uygula. Eski migration'ları veya verileri
   değiştirme; test/fixture canlıda çalıştırılmaz.
5. Tam adayı test et, read-only READY Preview ve canlı geçiş ön kontrolünü bitir.
   Www yayınının korumalı `YAYINLA` adımı kullanıcıya aittir; ajan taklit edemez.
6. Workflow ile gerçek tek taslak denemesini doğrula: yönetici kuyruğunda kapakla
   görünmeli; public API/RSS/sitemap ve ilanlarda görünmemeli. Denemede otomatik
   onay/yayın yapma. Sonucu doğrulamadan “sistem aktif” deme.

## URL'ler ve korunmuş yönlendirme

Haberlerin canonical adresi `/haber/<slug>` olur. Mevcut
`/pazartarla-gazete/haber/<slug>` adresleri 308 ile karşılığına yönlenir;
Magazin/Rehber ve Gazete yönetimi mevcut adresinde kalır. RSS/sitemap, ana sayfa
kartları ve paylaşım bağlantıları yeni Haber canonical'ını kullanır.
İlan URL'leri ve ilan arama/indexleme davranışı değişmez.

## Güvenli yerel doğrulama

```sh
python3 -m unittest discover -s tests/news -v
node --test tests/gazette-automation.test.mjs tests/turso-gazette.test.mjs \
  tests/gazette-news.test.mjs tests/gazette-seo.test.mjs
python3 fetch_news.py --check-sources
```

Son komut sadece kamuya açık kaynağı okur. AI çağrısı, upload, taslak veya canlı
veritabanı yazısı yapmaz. Testler sadece bellek içi SQLite/sentetik görsel kullanır.
