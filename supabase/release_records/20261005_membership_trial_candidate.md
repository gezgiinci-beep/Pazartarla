# Üyelik/deneme adayının doğrulama kaydı — 5 Ekim 2026

- Taslak PR: https://github.com/gezgiinci-beep/Pazartarla/pull/7
- Dal: `agent/www-membership-trial-20261005`.
- Başlangıç aday commit'i: `99b66ffc6744374c8d63312f34c39e87f5e94a3a`.
- Yalnız yedek açıklaması düzeltilmiş son commit:
  `f58d02d20476c50ea2574f397269f14e088707a0`; test edilen uygulama/SQL byte'ları değişmedi.
- Gerçek www baseline: `858f0f161da3c782410a0249687632c6fd556afd`.
- Tam iki Git ağacı karşılaştırıldı: yalnız 21 izin-listeli dosya değişti.
  App'te yalnız dört dar üyelik eklemesi var; özel teklif çalışması yok.
- Aday üzerinde 25 offline test başarılı; geçici yerel PostgreSQL annual/trial
  kontrolü ve Vite üretim derlemesi başarılı. Gerçek kişiler veya ilanlar üzerinde
  test yapılmadı. Gerçek Supabase Auth/PostgREST kabulü doğrulanmış sayılmaz.
- Kaynak önizlemesi açıldı ve kurulum bekleniyor durumunu gösterdi.
  Bu geliştirme önizlemesi, dar GitHub adayının veya canlı SQL'in kabul kanıtı değildir.
- GitHub push'u www için otomatik preview build'i kuyruğa aldı:
  `dpl_193KhCPkauz5gbMNR1m1Rujtw1qD`; agent production build/promotion başlatmadı.
- Push sonrası www `dpl_EV87aQH9BeD3dpmQmgMysBkh2F4G`,
  apex `dpl_CtobiVE4CzFp8gdAtJZcTAUHwQ5P` üzerinde kaldı;
  iki özel alan adı otomatik ataması da kapalıydı. Bu zamanlı bir gözlemdir;
  yayın öncesi tekrar doğrulanmalıdır.

## İncelenecek SQL hash'leri

| Dosya | SHA-256 |
|---|---|
| 20261004_store_memberships.sql | 053f48a5cd555c8351cf1faf965e5178be1a123f26b5a7c86a57b6d4d3711a2e |
| 20261005_annual_unlimited_store_plan.sql | 450a40356716451f79da3984bc166c75e93bc769b3bbcab484ad477d9d4cf39c |
| 20261005_free_store_trial.sql | 2322be477209167cf47e956816800143cd31bf92b3e88be626beca0025aa22fc |

Hash kaydı uygulama izni değildir. Beklenen repo dışı yedek dizini ve CA dosyası
erişilebilir değil; şifreli arşiv ve başarılı izole kurtarma kanıtı henüz yok.
Public anahtar normal ortam değişkeninde mevcut. Canlı SQL yazılmadı ve ayrı
canlı-SQL onayı alınmadı.

## Kullanıcı tarafından daraltılan kapanış kapsamı

Kullanıcı “Çalışmayı yalnız hazır yayın adayıyla sınırla” seçeneğini seçti.
Görev yalnız hazır taslak yayın adayı ve yerel doğrulamalar olarak teslim edilir.
Test edilmiş yedek, canlı SQL ve gerçek Supabase Auth/API kabulü sonraki ayrı
çalışmada tamamlanmalıdır; kullanıcı kontrollü Vercel yayın/promotion yapılmadı.
Kapanışta PR açık/taslak, head `f58d02d20476c50ea2574f397269f14e088707a0`,
tam Git ağaçlarında hâlâ yalnız 21 izin-listeli dosya değişmiştir.
www ve apex yukarıda kayıtlı aynı canlı deployment'larında kalmıştır.
