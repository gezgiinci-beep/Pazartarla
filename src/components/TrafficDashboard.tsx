import type { useTrafficReport } from '../hooks/useTrafficReport';
import { formatDuration, regionLabel } from '../lib/trafficAnalytics';
import './traffic-dashboard.css';

type TrafficDashboardState = ReturnType<typeof useTrafficReport>;

const numberFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});
const dayFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}

function formatDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return {
    date: dayFormat.format(date),
    weekday: new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'UTC' }).format(date),
  };
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="pt-traffic__stat" data-testid={`traffic-stat-${label.toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}`}>
      <span className="pt-traffic__stat-label">{label}</span>
      <strong className="pt-traffic__stat-value">{value}</strong>
      {note && <span className="pt-traffic__stat-note">{note}</span>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="pt-traffic__loading" role="status" aria-label="Trafik raporu yükleniyor">
      <span className="pt-traffic__skeleton pt-traffic__skeleton--heading" />
      <div className="pt-traffic__skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <span className="pt-traffic__skeleton" key={index} />)}
      </div>
      <span className="pt-traffic__skeleton pt-traffic__skeleton--wide" />
      <span className="pt-traffic__loading-label">Seçilen dönemin verileri getiriliyor…</span>
    </div>
  );
}

export default function TrafficDashboard({ state }: { state: TrafficDashboardState }) {
  const { days, setDays, refresh, loading, error, collectorError, data } = state;

  return (
    <section className="pt-traffic" aria-labelledby="traffic-title">
      <header className="pt-traffic__header">
        <div className="pt-traffic__heading">
          <div className="pt-traffic__eyebrow"><span aria-hidden="true" /> PAZARTARLA · SAHA ÖLÇÜMÜ</div>
          <h2 id="traffic-title">Ziyaretçi trafiği</h2>
          <p>İzin veren tarayıcıların ölçülen ziyaretleri, süreleri ve ilan görüntülemeleri.</p>
        </div>
        <button
          className="pt-traffic__refresh"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="button-traffic-refresh"
          aria-label={loading ? 'Rapor yenileniyor' : 'Trafik raporunu yenile'}
        >
          <span className={loading ? 'pt-traffic__refresh-mark is-turning' : 'pt-traffic__refresh-mark'} aria-hidden="true">↻</span>
          {loading ? 'Yenileniyor' : 'Şimdi yenile'}
        </button>
      </header>

      <div className="pt-traffic__controls">
        <div className="pt-traffic__period" role="group" aria-label="Rapor dönemi">
          {([7, 30, 90] as const).map((period) => (
            <button
              type="button"
              key={period}
              aria-pressed={days === period}
              className={days === period ? 'pt-traffic__period-button is-active' : 'pt-traffic__period-button'}
              onClick={() => setDays(period)}
              data-testid={`button-traffic-period-${period}`}
            >
              {period} gün
            </button>
          ))}
        </div>
        <span className="pt-traffic__timezone">Gün sınırı: Europe / Istanbul</span>
      </div>

      {collectorError && (
        <div className="pt-traffic__notice pt-traffic__notice--warning" role="status" data-testid="status-traffic-collector">
          <span className="pt-traffic__notice-mark" aria-hidden="true">!</span>
          <div><strong>Ölçüm bağlantısı uyarısı</strong><p>{collectorError}</p></div>
        </div>
      )}

      {loading && <LoadingState />}

      {!loading && error && (
        <div className="pt-traffic__error" role="alert" data-testid="status-traffic-error">
          <div className="pt-traffic__error-mark" aria-hidden="true">!</div>
          <div>
            <h3>Rapor alınamadı</h3>
            <p>{error}</p>
            <button type="button" className="pt-traffic__retry" onClick={() => void refresh()} data-testid="button-traffic-retry">
              Yeniden dene
            </button>
          </div>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="pt-traffic__empty" role="status" data-testid="status-traffic-empty">
          <span className="pt-traffic__empty-rule" aria-hidden="true" />
          <h3>Rapor bekleniyor</h3>
          <p>Seçilen dönem için trafik verisi henüz yüklenmedi.</p>
          <button type="button" className="pt-traffic__retry" onClick={() => void refresh()} data-testid="button-traffic-load">
            Raporu yükle
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="pt-traffic__report" data-testid="traffic-report">
          <div className="pt-traffic__report-meta">
            <span><i aria-hidden="true" /> {data.period_days} günlük rapor</span>
            <span>{formatDateTime(data.window_start)} tarihinden itibaren</span>
            <span>Son güncelleme: {formatDateTime(data.generated_at)}</span>
          </div>

          {data.summary.total_views === 0 && (
            <div className="pt-traffic__zero" role="status" data-testid="status-traffic-zero">
              <strong>Bu dönemde ölçülen ziyaret yok.</strong>
              <span>Tablolar rapordaki sıfır değerleri aynen gösterir; geçmişe dönük veri eklenmez.</span>
            </div>
          )}

          <section className="pt-traffic__section" aria-labelledby="traffic-overview-title">
            <div className="pt-traffic__section-heading">
              <div><span className="pt-traffic__section-index">01 / GENEL BAKIŞ</span><h3 id="traffic-overview-title">Ziyaret özeti</h3></div>
              <span className="pt-traffic__section-caption">Seçilen dönemin toplamı</span>
            </div>
            <div className="pt-traffic__stats">
              <StatCard label="Toplam sayfa görüntüleme" value={numberFormat.format(data.summary.total_views)} />
              <StatCard label="İlan detay görüntüleme" value={numberFormat.format(data.summary.detail_views)} note="Toplam görüntüleme içinde" />
              <StatCard label="Tekil tarayıcı" value={numberFormat.format(data.summary.unique_browsers)} note="Yaklaşık tarayıcı kimliği" />
              <StatCard label="Oturum" value={numberFormat.format(data.summary.total_sessions)} note="30 dk hareketsizlikte yeni oturum" />
              <StatCard label="Toplam aktif süre" value={formatDuration(data.summary.total_active_seconds)} note="Odaktaki görünür sayfalar" />
              <StatCard label="Ortalama oturum süresi" value={formatDuration(data.summary.avg_session_seconds)} />
              <StatCard label="Tarayıcı başına ziyaret" value={decimalFormat.format(data.summary.visits_per_browser)} />
              <StatCard label="Geri dönen tarayıcı oranı" value={`${percentFormat.format(data.summary.returning_rate)}%`} />
            </div>
          </section>

          <section className="pt-traffic__section" aria-labelledby="traffic-daily-title">
            <div className="pt-traffic__section-heading">
              <div><span className="pt-traffic__section-index">02 / GÜN GÜN</span><h3 id="traffic-daily-title">Günlük hareket</h3></div>
              <span className="pt-traffic__section-caption">Sıfır günler raporda korunur</span>
            </div>
            <div className="pt-traffic__table-wrap">
              <table className="pt-traffic__table pt-traffic__table--daily">
                <caption className="pt-traffic__sr-only">Günlük görüntüleme, oturum ve aktif süre</caption>
                <thead><tr><th scope="col">Gün</th><th scope="col">Görüntüleme</th><th scope="col">Oturum</th><th scope="col">Aktif süre</th></tr></thead>
                <tbody>
                  {data.daily.map((day) => {
                    const label = formatDay(day.day);
                    return (
                      <tr key={day.day} data-testid={`row-traffic-day-${day.day}`}>
                        <th scope="row"><span className="pt-traffic__day">{label.date}</span><span className="pt-traffic__weekday">{label.weekday}</span></th>
                        <td>{numberFormat.format(day.views)}</td>
                        <td>{numberFormat.format(day.sessions)}</td>
                        <td>{formatDuration(day.active_seconds)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="pt-traffic__section" aria-labelledby="traffic-regions-title">
            <div className="pt-traffic__section-heading">
              <div><span className="pt-traffic__section-index">03 / NEREDEN</span><h3 id="traffic-regions-title">Bölgelere göre</h3></div>
              <span className="pt-traffic__section-caption">Payın paydası: tüm site görüntülemeleri</span>
            </div>
            <p className="pt-traffic__table-intro">
              {data.region_count > data.regions.length
                ? `İlk ${data.regions.length} / ${numberFormat.format(data.region_count)} bölge gösteriliyor.`
                : `${numberFormat.format(data.region_count)} bölge kaydı.`}
            </p>
            {data.regions.length > 0 ? (
              <div className="pt-traffic__table-wrap">
                <table className="pt-traffic__table pt-traffic__table--wide">
                  <caption className="pt-traffic__sr-only">Bölge bazında görüntüleme ve oturum metrikleri</caption>
                  <thead><tr><th scope="col">Yaklaşık konum</th><th scope="col">Görüntüleme</th><th scope="col">Pay</th><th scope="col">Tarayıcı</th><th scope="col">Oturum</th><th scope="col">Aktif süre</th><th scope="col">Ort. oturum</th><th scope="col">Ziyaret / tarayıcı</th></tr></thead>
                  <tbody>
                    {data.regions.map((region, index) => (
                      <tr key={`${region.country ?? 'unknown'}-${region.region ?? 'unknown'}-${index}`} data-testid={`row-traffic-region-${index}`}>
                        <th scope="row">{regionLabel(region.country, region.region)}</th>
                        <td>{numberFormat.format(region.views)}</td>
                        <td>{percentFormat.format(region.share_percent)}%</td>
                        <td>{numberFormat.format(region.browsers)}</td>
                        <td>{numberFormat.format(region.sessions)}</td>
                        <td>{formatDuration(region.active_seconds)}</td>
                        <td>{formatDuration(region.avg_session_seconds)}</td>
                        <td>{decimalFormat.format(region.visits_per_browser)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pt-traffic__table-empty">Bu dönemde bölge kaydı yok.</div>
            )}
          </section>

          <section className="pt-traffic__section" aria-labelledby="traffic-listings-title">
            <div className="pt-traffic__section-heading">
              <div><span className="pt-traffic__section-index">04 / İLANLAR</span><h3 id="traffic-listings-title">En çok görüntülenen ilanlar</h3></div>
              <span className="pt-traffic__section-caption">Payın paydası: tüm ilan detay görüntülemeleri</span>
            </div>
            <p className="pt-traffic__table-intro">
              {data.listing_count > data.listings.length
                ? `İlk ${data.listings.length} / ${numberFormat.format(data.listing_count)} ilan gösteriliyor.`
                : `${numberFormat.format(data.listing_count)} ilan kaydı.`}
            </p>
            {data.listings.length > 0 ? (
              <div className="pt-traffic__table-wrap">
                <table className="pt-traffic__table pt-traffic__table--listings">
                  <caption className="pt-traffic__sr-only">İlan detay görüntüleme sıralaması</caption>
                  <thead><tr><th scope="col">Sıra</th><th scope="col">İlan</th><th scope="col">Detay görüntüleme</th><th scope="col">Pay</th><th scope="col">Aktif süre</th></tr></thead>
                  <tbody>
                    {data.listings.map((listing, index) => (
                      <tr key={listing.listing_id} data-testid={`row-traffic-listing-${listing.listing_id}`}>
                        <td><span className="pt-traffic__rank">{String(index + 1).padStart(2, '0')}</span></td>
                        <th scope="row"><span className="pt-traffic__listing-title">{listing.title}</span><span className="pt-traffic__listing-id">İlan no: {listing.listing_id}</span></th>
                        <td>{numberFormat.format(listing.views)}</td>
                        <td>{percentFormat.format(listing.share_percent)}%</td>
                        <td>{formatDuration(listing.active_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pt-traffic__table-empty">Bu dönemde ilan detay görüntülemesi yok.</div>
            )}
          </section>

          <aside className="pt-traffic__method" aria-labelledby="traffic-method-title">
            <div className="pt-traffic__method-head">
              <span className="pt-traffic__section-index">ÖLÇÜMÜ OKURKEN</span>
              <h3 id="traffic-method-title">Sınırlar ve gizlilik</h3>
            </div>
            <p className="pt-traffic__collection-start">
              <strong>Veri toplama başlangıcı:</strong> {formatDateTime(data.collection_started_at)}. İstatistikler yalnızca izin veren ziyaretçiler için bu tarihten itibaren toplanır; geçmişe dönük veri üretilmez.
            </p>
            <ul className="pt-traffic__method-list">
              <li>Konum IP üzerinden yaklaşık ülke ve ilk düzey il/bölge tahminidir. VPN veya mobil ağ konumu farklı gösterebilir; kesin GPS konumu değildir.</li>
              <li>Ham IP adresi veya hesap bilgisi kaydedilmez. Görüntüleme ve tarayıcı kimlikleri tahminidir; doğrulanmış faturalama metriği değildir.</li>
              <li>Aynı kişi farklı cihazlarda veya gizli sekmelerde ayrı tarayıcı olarak sayılabilir.</li>
              <li>Oturum, 30 dakika hareketsizlikten sonra yenilenir.</li>
              <li>Aktif süre yalnızca sayfa görünür ve odaktayken ölçülür; video izleme süresi değildir. Reklam engelleyici veya sayfanın kapanması ölçümü eksik bırakabilir.</li>
              <li>Raporlar son 90 güne kadar veri içerir; 90 günden eski kayıtlar günlük temizlenir. Günler Europe/Istanbul saat dilimine göre hesaplanır.</li>
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}