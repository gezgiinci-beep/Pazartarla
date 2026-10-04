# Üyelik, ilan kotası ve yönetici onayı

Yeni ilanlar doğrulanmış e-posta hesabı gerektirir ve `pending` olarak
kaydedilir. Kullanıcı başına kayan 24 saatlik dönemde en fazla 3 gönderim
yapılabilir. Yönetici onayı, ret veya silme bu kotayı sıfırlamaz.
Mevcut onaylı ilanların içerikleri değiştirilmez.

## Veritabanı

Önce `ADMIN_SETUP.md` içindeki yönetici güvenliği kurulmuş olmalıdır.
Ardından `migrations/20261004_moderated_submissions.sql` dosyasını aynı
Supabase projesinde bir bütün olarak uygulayın. Bu işlem mevcut onaylı
ilanları değiştirmez; anonim gönderimi hemen engeller. Dolayısıyla yeni
arayüz yayımlanıncaya kadar eski anonim ilan formu gönderim yapamaz.

Sahiplik ve gönderim zamanı veritabanında atanır. Kota kaydı özel
şemadadır ve istemciden okunamaz/değiştirilemez. Aynı hesabın eşzamanlı
gönderimleri işlem kilidiyle sıraya alınır. Kullanıcılar yalnız kendi
bekleyen/reddedilen ilanlarını görebilir; yönetici onay/red yetkisi
mevcut veritabanı yönetici kurallarıyla korunur.

## Supabase Auth ayarları

- E-posta ile kayıt ve e-posta doğrulaması açık olmalı; otomatik e-posta
  onayı kapalı kalmalıdır.
- Site URL `https://www.pazartarla.com.tr` olmalıdır. Bu adresi ve
  kullanacağınız Vercel önizleme adresinin kökünü Redirect URLs
  listesine ekleyin. Uygulama doğrulama dönüşünde bulunduğu adresin
  kökünü kullanır.
- Herkese açık üyelik için doğrulama e-postalarının gerçekten
  gönderilebildiğini kontrol edin. Supabase'in varsayılan e-posta
  sağlayıcısının alıcı ve gönderim sınırları vardır; genel kullanıcılar
  için uygun bir SMTP sağlayıcısı gerekebilir. SMTP parolalarını yalnız
  Supabase'in güvenli ayarlar ekranında saklayın.
- Vercel önizleme ve üretim ortamlarında mevcut `VITE_SUPABASE_URL` ve
  `VITE_SUPABASE_ANON_KEY` ayarları bulunmalıdır. Service-role anahtarını
  tarayıcıya koymayın.

## Kontroller

`npm run check:startup` açılışın kimlik doğrulamadan bağımsız kalmasını
kontrol eder.

`npm run check:submissions`, güvenli ortamda tanımlı
`SUPABASE_DATABASE_URL` ve `SUPABASE_DATABASE_CA_FILE` ile çalışır.
Varsayılan CA dosyası `/tmp/pazartarla-supabase-ca.crt` konumudur;
Supabase'in resmi kök sertifikasını kullanın. Test yalnız beklenen
Supabase projesine bağlanır, geçici kayıtları ve geçici yetki
değişikliklerini tek işlemde sınar ve her durumda geri alır. Sayaçlarda
normal işlem geri alma davranışı nedeniyle kimlik numarası boşlukları
oluşabilir; mevcut ilanlar ve yönetici erişimi korunur.

Yeni doğrulama e-postasının alınıp bağlantısıyla geri dönülmesi ve gerçek
hesapla giriş yapılması ayrıca doğrulanmalıdır. Veritabanı kontrolleri
e-posta teslimatını veya Vercel önizleme erişim korumasını test etmez.