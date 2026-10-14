import type { useTrafficReport } from '../hooks/useTrafficReport';
import './traffic-dashboard.css';

type DashboardState = ReturnType<typeof useTrafficReport>;

const numberFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

function dayLabel(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00Z`));
}

function position(value: number | null | undefined) {
  return value === null || value === undefined || value === 0 ? '—' : decimalFormat.format(value);
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="pt-traffic__stat">
      <span className="pt-traffic__stat-label">{label}</span>
      <strong className="pt-traffic__stat-value">{value}</strong>
      {note && <span className="pt-traffic__stat-note">{note}</span>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="pt-traffic__loading" role="status" aria-label="Google arama raporu yükleniyor">
      <span className="pt-traffic__skeleton pt-traffic__skeleton--heading" />
      <div className="pt-traffic__skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <span className="pt-traffic__skeleton" key={index} />)}
      </div>
      <span className="pt-traffic__skeleton pt-traffic__skeleton--wide" />
      <span className="pt-traffic__loading-label">Google Search Console verileri getiriliyor…</span>
    </div>
  );
}

function MetricTable({ title, index, caption, rows, firstHeading, firstKey }: {
  title: string;
  index: string;
  caption: string;
  rows: Array<Record<string, string | number>>;
  firstHeading: string;
  firstKey: string;
}) {
  return (
    <section className="pt-traffic__section">
      <div className="pt-traffic__section-heading">
        <div><span className="pt-traffic__section-index">{index}</span><h3>{title}</h3></div>
        <span className="pt-traffic__section-caption">{caption}</span>
      </div>
      {rows.length === 0 ? (
        <p className="pt-traffic__empty-note">Seçilen dönemde Google arama kaydı bulunmuyor.</p>
      ) : (
        <div className="pt-traffic__table-wrap">
          <table className="pt-traffic__table pt-traffic__table--wide">
            <caption className="pt-traffic__sr-only">{caption}</caption>
            <thead>
              <tr>
                <th scope="col">{firstHeading}</th>
                <th scope="col">Tıklama</th>
                <th scope="col">Gösterim</th>
                <th scope="col">Tıklama oranı</th>
                <th scope="col">Ortalama konum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${String(row[firstKey])}-${rowIndex}`}>
                  <th scope="row">{String(row[firstKey])}</th>
                  <td>{numberFormat.format(Number(row.clicks))}</td>
                  <td>{numberFormat.format(Number(row.impressions))}</td>
                  <td>{percentFormat.format(Number(row.ctr))}%</td>
                  <td>{position(Number(row.averagePosition))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function TrafficDashboard({ state }: { state: DashboardState }) {
  const { days, setDays, refresh, loading, error, data } = state;
  return (
    <section className="pt-traffic" aria-labelledby="traffic-title">
      <header className="pt-traffic__header">
        <div className="pt-traffic__heading">
          <div className="pt-traffic__eyebrow"><span aria-hidden="true" /> GOOGLE SEARCH CONSOLE</div>
          <h2 id="traffic-title">Google arama performansı</h2>
          <p>Google aramalarındaki tıklama, gösterim, arama terimi ve sayfa verileri.</p>
        </div>
        <button
          className="pt-traffic__refresh"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="button-traffic-refresh"
        >
          <span className={loading ? 'pt-traffic__refresh-mark is-turning' : 'pt-traffic__refresh-mark'} aria-hidden="true">↻</span>
          {loading ? 'Yenileniyor' : 'Şimdi yenile'}
        </button>
      </header>

      <div className="pt-traffic__controls">
        <div className="pt-traffic__period" role="group" aria-label="Rapor dönemi">
          {([7, 30, 90] as const).map(period => (
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
        <span className="pt-traffic__timezone">Google verisi birkaç gün gecikmeli yayımlanabilir.</span>
      </div>

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
        <div className="pt-traffic__empty" role="status">
          <span className="pt-traffic__empty-rule" aria-hidden="true" />
          <h3>Rapor bekleniyor</h3>
          <p>Seçilen dönem için Google arama verileri yükleniyor.</p>
          <button type="button" className="pt-traffic__retry" onClick={() => void refresh()}>Raporu yükle</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="pt-traffic__report" data-testid="traffic-report">
          <div className="pt-traffic__report-meta">
            <span><i aria-hidden="true" /> {data.periodDays} günlük rapor</span>
            <span>{dayLabel(data.startDate)} – {dayLabel(data.endDate)}</span>
            <span>Son güncelleme: {dateTimeFormat.format(new Date(data.generatedAt))}</span>
          </div>
          <section className="pt-traffic__section" aria-labelledby="traffic-overview-title">
            <div className="pt-traffic__section-heading">
              <div><span className="pt-traffic__section-index">01 / GENEL BAKIŞ</span><h3 id="traffic-overview-title">Arama özeti</h3></div>
              <span className="pt-traffic__section-caption">Seçilen dönemin toplamı</span>
            </div>
            <div className="pt-traffic__stats">
              <StatCard label="Tıklama" value={numberFormat.format(data.summary.clicks)} />
              <StatCard label="Gösterim" value={numberFormat.format(data.summary.impressions)} />
              <StatCard label="Tıklama oranı" value={`${percentFormat.format(data.summary.ctr)}%`} />
              <StatCard label="Ortalama konum" value={position(data.summary.averagePosition)} />
            </div>
          </section>

          <section className="pt-traffic__section" aria-labelledby="traffic-daily-title">
            <div className="pt-traffic__section-heading">
              <div><span className="pt-traffic__section-index">02 / GÜN GÜN</span><h3 id="traffic-daily-title">Günlük hareket</h3></div>
              <span className="pt-traffic__section-caption">Google organik arama</span>
            </div>
            <div className="pt-traffic__table-wrap">
              <table className="pt-traffic__table pt-traffic__table--daily">
                <caption className="pt-traffic__sr-only">Günlük tıklama ve gösterim</caption>
                <thead><tr><th scope="col">Gün</th><th scope="col">Tıklama</th><th scope="col">Gösterim</th><th scope="col">Tıklama oranı</th><th scope="col">Konum</th></tr></thead>
                <tbody>
                  {data.daily.map(row => (
                    <tr key={row.date} data-testid={`row-traffic-day-${row.date}`}>
                      <th scope="row">{dayLabel(row.date)}</th>
                      <td>{numberFormat.format(row.clicks)}</td>
                      <td>{numberFormat.format(row.impressions)}</td>
                      <td>{percentFormat.format(row.ctr)}%</td>
                      <td>{position(row.averagePosition)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <MetricTable title="Arama terimleri" index="03 / NE ARANDI" caption="Google’da kullanılan sorgular" rows={data.queries} firstHeading="Sorgu" firstKey="query" />
          <MetricTable title="En çok görülen sayfalar" index="04 / HANGİ SAYFA" caption="Google arama sonuçlarında gösterilen sayfalar" rows={data.pages} firstHeading="Sayfa" firstKey="page" />
          <MetricTable title="Ülkeler" index="05 / NEREDEN" caption="Search Console ülke kodları" rows={data.countries} firstHeading="Ülke kodu" firstKey="country" />
        </div>
      )}
    </section>
  );
}
