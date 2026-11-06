# Resmî satış telefonu

## Halkbank ve Ziraat Bankası

Halkbank'ın resmî portalında yalnız halka açık `ListeTumu` ve `Detay`
okuma servisleri kullanılır. `/ilan-detay/<seriNo>` kaynak kimliği detay
yanıtıyla karşılaştırılır; ayrı GYO ilanları, konut ve işyerleri elenir.
Fotoğraflar ve uzun açıklamalar kopyalanmaz. Bankanın başlangıç fiyatı
“İhale başlangıç bedeli” olarak korunur; ilgili şubenin açık telefon bilgisi
varsa taslağa alınır.

Ziraat Bankası'nın halka açık Arsa araması, kısa ömürlü anonim çerez ve
ViewState ile sorgulanır. Yalnız `searchForm` içindeki “Ara” düğmesi
kullanılır; giriş, teklif ve iletişim formlarına istek gönderilmez.
Kayıtlı URL'lerden anonim oturum ve izleme parametreleri temizlenir.
Fizikî ihale kartının gizli sona-erdi şablonu ancak açık ihale tarihi
henüz geçmemişse göz ardı edilir. Süresi geçmiş veya durumu belirsiz
ilanlar bu istisnayla kabul edilmez.

## Her taramada 10 uygun taslak hedefi

VakıfBank ve Vakıf Leasing için yalnız ilk katalog sayfası değil, kurumun
halka açık arama servisindeki en fazla 8 sayfa taranır. Her sayfa en fazla
50 kayıt döndürür; altı saatlik zaman dilimlerine göre diğer sayfalara da
sıra gelir. Arama POST isteği yalnız sabit `/look-up/search` sorgusudur;
oturum açılmaz, teklif verilmez, iletişim formu gönderilmez.

Kaynak kurum ve tarımsal varlık türü her kayıtta doğrulanır; sona ermiş
ihaleler elenir. Aynı kaynak kimliği tekilleştirilir. Hedef 10 taslaktır;
daha önce aktarılmış veya reddedilmiş kayıtlar hedefi tüketmez ve yeniden
açılmaz. Tarama başına en fazla 40 aktarım denemesi yapılır. Özet,
`accepted`, `skipped_reviewed`, `target` ve `shortfall` sayılarını ayrı
raporlar; yeterli resmî ilan yoksa 10'a tamamlamak için kayıt üretilmez.

Otomasyon yalnız ilanın resmî kaynak sayfasındaki açık satış iletişim alanını
okur. VakıfBank/Vakıf Leasing için `callUs` içindeki `tel:` bağlantısı,
diğer kaynaklarda açıkça etiketlenmiş satış telefonu tablo satırları kullanılır.
Altbilgi, form girdileri veya genel sayfa metninden telefon tahmin edilmez.
Türkiye numaraları `0XXXXXXXXXX` biçimine dönüştürülür. Birden fazla farklı
numara, erişim hatası veya doğrulanamayan işaretleme varsa numara boş kalır.
Numaralar çalışma günlüklerine yazılmaz.

`contact_phone` isteğe bağlı bir taslak bilgisidir; mevcut `facts_json`
içinde saklanır, yeni tablo/sütun gerektirmez. Eski kayıtlar uyumludur.
Telefon değişirse taslak sürümü de değişir; kaldırılırsa eski numara korunmaz.
Taslak kartı resmî numarayı başlangıç değeri olarak kullanır, yönetici
düzeltebilir ve resmî kaynak kontrolünü ayrıca onaylamalıdır.
Aktarım ve yayın onayları aynen korunur.

Canlıya geçiş hem web/backend sürümünün hem GitHub banka üreticisinin
güncellenmesini gerektirir. Yalnız web yayını mevcut taslaklara numara eklemez.
Aktarılmamış taslaklar sonraki başarılı otomasyon taramasında güncellenir;
önceden aktarılmış veya yayımlanmış ilanların telefonu otomatik değiştirilmez.

# Banka kaynaklı tarım ilanları

Bu modül **Gazete değildir**. Haber API'si, haber tablosu, Gemini ve haber
iş akışı kullanılmaz.

## Kapsam ve gerçek kaynak durumu

- Seçilen bankalar: Ziraat Bankası, Halkbank, VakıfBank.
- Kullanıcının onayıyla Vakıf Leasing, Halk Leasing ve Ziraat Leasing
  resmî ikinci el satışları ayrıca eklenmiştir. Satıcı adı bu şirketin
  kendisidir; bankanın adı altında yayımlanmaz.
- Vakıf Leasing'in kendi resmî satış sayfasından doğrudan bağlanan şirkete
  özel Intengo kataloğu okunur; uygun kayıtların gerçek detay sayfasında
  satıcı, tarımsal nitelik, para birimi ve bedel tekrar doğrulanır.
  Şirketin ana sitesindeki eksik TLS zinciri için sertifika kontrolü
  kapatılmaz; belgelenmiş, açık Intengo kataloğu kullanılır.
  Halk Leasing'in makine, taşıt ve gayrimenkul
  satış sayfaları okunur. Ziraat Leasing'in tablolarında yalnız tarımsal
  makine ve yayımlanmış sabit seri/stok/ilan referansı bulunan kayıt alınır.
  Kararsız sıra numarası veya fiyat değişikliği yeni bir ilan kimliği yapılmaz.
- Tarla, bağ, bahçe, satılık çiftlik, traktör ve açıkça tarımsal olduğu
  belirtilen makineler sınıflandırılır. Genel arsa, otomobil, sanayi makinesi
  veya adresinde “Çiftlik/Tarla” geçen konutlar tarım ilanı sayılmaz.
- Ziraat'ın herkese açık yeni gayrimenkuller kataloğu ve VakıfBank'ın
  Intengo kataloğu için okuyucular vardır. Her katalog tüm araç/makine
  envanterini kapsamayabilir: sınıflandırmanın bulunması, bankanın ayrı araç
  portalının da bağlandığı anlamına gelmez.
- Halkbank'ın HTML uygulama kabuğu/veri uçları güvenilir bir açık katalog
  olarak doğrulanamadığından okuyucu **duraklatılmıştır**. Çalışıyor veya
  tüm üç bankanın envanteri aktarılıyor diye raporlanmamalıdır.
- Gerçek kaynak ön kontrolünde iki okunabilen katalogda uygun aday
  bulunmayabilir. Örnek/sahte ilan oluşturulmaz; sıfır sonuç gerçek sonuçtur.
- Kaynak robots kuralları, HTTPS/alan adı sınırı ve boyut sınırı uygulanır.
  Giriş, CAPTCHA, teklif verme ve banka iletişim formları kullanılmaz.

## Akış ve güvenlik

1. `scripts/bank_listings.py`, yalnız asgari ilan gerçeklerini alır.
   Uzun açıklama, banka logosu ve mülk fotoğrafı kopyalanmaz.
2. Ayrı GitHub OIDC kimliği `/api/bank-listings` adresine yalnız `action=import`
   gönderebilir. Banka/haber iş akışlarının kimlikleri birbirinin yerine geçmez.
3. Kayıt yalnız `private__bank_listing_drafts` içine `status='draft'` olarak
   girer. Her bankanın kaynak kimliği benzersizdir; tekrar tarama çoğaltmaz.
4. Yönetici bankanın güncel kaynağını, bedelin anlamını ve gerçek kurum
   telefonunu inceler; mevcut kategori/alt kategoriyi seçer.
5. “İlan onayına aktar” ayrı bir yayın onayı değildir. Atomik işlem ile normal
   `listings.status='pending'` oluşturur, taslağı bu ilana bağlar. Tekrarlanan
   istek ikinci ilan oluşturmaz.
6. Yayın için mevcut ilan onay ekranındaki normal yönetici kararı gerekir.
   İş akışı, importer token'ı ve taslak API'si bu onayı veremez.
7. İhale bedeli sabit satış fiyatı gibi adlandırılmaz. İlan başlığı bedelin
   ihale başlangıcı olduğunu söyler; açıklama kaynağa ve koşullara yönlendirir.
   PazarTarla bankanın satıcısı/ihale düzenleyicisi gibi gösterilmez.
8. Sahte banka üyeliği açılmaz. İlanı gönderen yetkili yöneticidir; banka
   iletişim bilgileri üyelerin iletişim deposuna veya toplu mesaja eklenmez.
9. Fiyatı olmayan veya son kaynak kontrolü 24 saatten eski taslak aktarılamaz.
   Kaynak değişince sürüm artar, eski yönetici incelemesi geçersiz olur.
   Reddedilen/aktarılmış kayıt yeniden otomatik taslak yapılmaz.
10. EUR/USD bedeli ve KDV dahil/hariç notu kaynakta olduğu gibi korunur.
    İlanların mevcut TL fiyat alanına döviz miktarı yazılmaz, kur uydurulmaz.
    Dövizli kayıt özel taslakta görüntülenir ancak TL ilanlarına aktarımı kapalıdır.
11. Kaynaklar sırayla aday verir; tek bir bankanın tekrarlanan kayıtları
    leasing şirketlerinin adaylarını günlük çalışmalardan dışlayamaz.

## Etkinleştirme

Kodun bulunması canlıda devrede olduğu anlamına gelmez. Önce ayrı test:

```sh
python3 -B -m unittest discover -s tests/bank_listings
node --test tests/bank-listing-drafts.test.mjs
python3 -B scripts/bank_listings.py --dry-run
```

Üretim için önce mevcut güvenli Turso yedek/migrasyon süreciyle
`0019_bank_listing_drafts.sql` (banka ve leasing kapsamlı sürüm) uygulanmalı, yeni web/API kaynakları doğrulanmış
www adayına dahil edilmeli, kullanıcı korumalı Shell onayını vermelidir.
Bu çalışma üretim şemasını kendiliğinden değiştirmez.

Vercel Production ortamında `PAZARTARLA_BANK_IMPORT_ENABLED=true`, GitHub
depo değişkeninde aynı isim/değer ve `bank-listing-import` environment gerekir.
Sonra `fetch-bank-listings.yml` ile `scripts/bank_listings.py` ve
`scripts/leasing_sources.py` dosyaları GitHub'a güvenli üretici
güncellemesiyle aktarılır. Önce dry-run, ardından gerçek özel taslak aktarımı
kontrol edilir. **Yeni banka/API/Gemini gizli anahtarı gerekmez.**

Mevcut GitHub `main` web kaynakları www'den eski olabilir. Sıradan bir push
www'yi eski sürüme döndürebilir; mevcut tek-commit build-skip ve alias kontrol
korumaları olmadan bu üretici güncellemesi yapılmamalıdır.
