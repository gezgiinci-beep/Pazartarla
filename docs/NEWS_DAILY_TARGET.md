# Günlük güncel haber taslağı hedefi

## Çalışma

- GitHub Actions: `25 */2 * * *` UTC; Türkiye saatiyle 01:25, 03:25,
  05:25, 07:25, 09:25, 11:25, 13:25, 15:25, 17:25, 19:25, 21:25, 23:25.
  GitHub zamanlanmış işleri geciktirebilir; bunlar kesin teslim saatleri değildir.
- Hedef Türkiye takvim günü başına **10 farklı, son 72 saatte yayımlanmış**
  haberden taslak hazırlamak. Bir çalışmada en fazla 6 taslak, 8 yeniden yazım
  girişimi. Geçici 5xx tekrarları mevcut 5/10 saniyelik beklemeyi korur.
- Sunucu sınırı Türkiye takvim gününde 20 ithal kayıt; 10 hedefiyle aynı şey
  değildir. Silinen veya sonradan yayımlanan taslak da ithal defterinde kalır;
  yeniden ithal edilmez ve kotayı sıfırlamaz.
- Her iş önce OIDC korumalı `GET /api/gazette-import?action=stats` ile ilerlemeyi
  okur. Eksik kalan kadar hazırlar; hedef dolduğunda kaynak/AI çağrısı yapmaz.
- Kaynaklar en fazla 6 paralel okuyucu, kaynak başına en fazla 6 makale
  isteği, ağ isteği başına 12 saniye ile taranır. Kaynak rotasyonu ve
  dönüşümlü sıralama korunur; aynı tazelik grubunda destek/hibe başlıkları öne alınır.
- RSS akışında en fazla 60 kayıt incelenir; bilinen URL'ler makale/AI
  isteğinden önce elenir. Eski kayıtlar için kalıcı URL sorgusu da korunur.
- Bir kaynakta 403/404 görülmesi diğer kaynakları durdurmaz. Gemini veya ithal
  API'sinde kimlik/kota hatası işin durmasına yol açar; ücretli servis/model
  değişikliği yapılmaz. 18 dakikalık iş bütçesi ve 25 dakikalık Actions sınırı vardır.

## Kaynaklar

Mevcut Bakanlık, TKDK, belediye, oda ve bölgesel kaynaklara TAGEM, TRGM,
HAYGEM, BÜGEM, Batı Akdeniz ve Ege tarımsal araştırma enstitüleri,
Isparta Uygulamalı Bilimler ve Ondokuz Mayıs üniversitelerinin ziraat
fakülteleri ile Tarımdan Haber'in herkese açık RSS akışı eklenmiştir.

Fakülte eğitim/oryantasyon duyuruları sırf fakülteye ait oldukları için tarım
haberi sayılmaz. Metni okunamayan afişler, doğrulanamayan tarihler ve tarım
dışı içerikler atlanır. 403 veren portallar eklenmedi; erişim engeli aşılmaz.
RSS kullanımı fotoğraf veya tam makale yeniden yayımlama izni değildir.

Tüm yeni Türkiye kaynaklarında özgün, temsili PazarTarla kapağı hazırlanır;
kurum/portal fotoğrafı, logo veya afişi kopyalanmaz. Kaynak bağlantısı ve
özgün yayın tarihi editör notunda korunur. Yeniden yazım, telif veya Discover
uygunluğu garantisi değildir.

## Hedef ve raporlama

Günlük 10 bir **operasyonel hedeftir**, doğrulanmış haber bulunmadığında veya
Gemini ücretsiz kotası yeterli olmadığında kesin adet taahhüdü değildir.
Eksik sayı Actions iş özetine yazılır; sonraki zamanlanmış tarama yeniden
dener. Tarih değiştirme, aynı URL'yi tekrar alma, eski haberle doldurma ve
otomatik yayın yoktur. Farklı kaynakların aynı olayı anlatması hâlâ editör
incelemesi gerektirir.

İthalat yalnız özel gazete tablolarına `category='haber', status='draft'`,
`published_at=NULL` olarak yazar. İlan içe aktarma ve bekletilen tedarikçi
modülünü etkinleştirmez. Mevcut admin taslak kuyruğu kullanılır.

## Güvenli etkinleştirme sırası

Yeni kaynak izin listesi, istatistik API'si ve günlük sınır sunucuda değiştiği
için **önce bu haber değişikliklerini içeren www sürümü**, ardından aynı
dosyaların GitHub üreticisi yayımlanmalıdır. Eski sunucuya yeni üretici
bağlanmamalı. Yerel dosya değişikliği zamanlanmış GitHub işini kendiliğinden
güncellemez. Üretim kaydı yazmadan kaynak kontrolü:

```sh
python fetch_news.py --check-sources --source tr-tagem --source tr-tarimdanhaber-rss
python -m unittest discover -s tests/news -v
node --experimental-strip-types --test tests/gazette-automation.test.mjs
```
