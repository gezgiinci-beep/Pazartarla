import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { useContactDepot } from '../hooks/useContactDepot';
import {
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_BYTES,
  inferImportMapping,
  prepareContactImport,
  readContactFile,
} from '../lib/contactImport';
import type { ImportMapping, ImportResult, ImportRow, ImportSheet } from '../lib/contactImport';
import './contact-bulk-import.css';

type Props = { state: ReturnType<typeof useContactDepot>; onClose: () => void };
type Stage = 'idle' | 'reading' | 'preflight' | 'importing';
type ViewRow = { row: number; name: string; email: string; phone: string; status: string; reason: string };
const PAGE_SIZE = 50;
const numberFormat = new Intl.NumberFormat('tr-TR');
const fieldNames: Array<[keyof ImportMapping, string, boolean]> = [
  ['name', 'Ad / ad soyad', false],
  ['surname', 'Soyad', true],
  ['email', 'E-posta', true],
  ['phone', 'Telefon', true],
];

function statusLabel(status: string) {
  return ({
    ready: 'Önizlemede uygun',
    imported: 'İçe aktarıldı',
    invalid: 'Hatalı',
    duplicate: 'Mevcut / yinelenen',
    pending: 'Kontrol bekliyor',
  } as Record<string, string>)[status] ?? status;
}

export default function ContactBulkImport({ state, onClose }: Props) {
  const { processImport, busy, refresh } = state;
  const mounted = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<ImportSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ImportMapping>({ name: -1, surname: -1, email: -1, phone: -1 });
  const [fileIssues, setFileIssues] = useState<ImportResult[]>([]);
  const [serverResults, setServerResults] = useState<ImportResult[]>([]);
  const [preparedRows, setPreparedRows] = useState<ImportRow[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(0);
  const [requestBase, setRequestBase] = useState('');
  const [commitRows, setCommitRows] = useState<ImportRow[]>([]);
  const [preflightStarted, setPreflightStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const sheet = sheets[sheetIndex];
  const prepared = useMemo(() => {
    if (!sheet) return null;
    try { return prepareContactImport(sheet, mapping); }
    catch { return null; }
  }, [sheet, mapping]);
  const busyLocal = stage !== 'idle' || busy;
  const pages = useMemo(() => Math.max(1, Math.ceil((sheet?.rows.length ?? 0) / PAGE_SIZE)), [sheet]);
  const allRows = useMemo<ViewRow[]>(() => {
    if (!sheet) return [];
    const rows: ViewRow[] = [];
    const prepped = new Map((preparedRows.length ? preparedRows : prepared?.rows ?? []).map((row) => [row.row, row]));
    const statuses = new Map<number, ImportResult>();
    prepared?.issues.forEach((result) => statuses.set(result.row, result));
    fileIssues.forEach((result) => statuses.set(result.row, result));
    serverResults.forEach((result) => statuses.set(result.row, result));
    sheet.rows.forEach((cells, index) => {
      const rowNumber = index + 2;
      const result = statuses.get(rowNumber);
      const clean = prepped.get(rowNumber);
      const readCell = (column: number) => column < 0 ? '' : String(cells[column] ?? '').trim();
      const name = clean?.name ?? [readCell(mapping.name), mapping.surname < 0 ? '' : readCell(mapping.surname)].filter(Boolean).join(' ');
      rows.push({
        row: rowNumber,
        name,
        email: clean?.email ?? readCell(mapping.email),
        phone: clean?.phone ?? readCell(mapping.phone),
        status: result?.status ?? 'pending',
        reason: result?.reason ?? '',
      });
    });
    return rows;
  }, [sheet, mapping, prepared, preparedRows, fileIssues, serverResults]);
  const visibleRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const counts = useMemo(() => {
    const combined = new Map<number, ImportResult>();
    prepared?.issues.forEach((item) => combined.set(item.row, item));
    fileIssues.forEach((item) => combined.set(item.row, item));
    serverResults.forEach((item) => combined.set(item.row, item));
    const values = [...combined.values()];
    return {
      ready: values.filter((item) => item.status === 'ready').length,
      imported: values.filter((item) => item.status === 'imported').length,
      invalid: values.filter((item) => item.status === 'invalid').length,
      duplicate: values.filter((item) => item.status === 'duplicate').length,
    };
  }, [prepared, fileIssues, serverResults]);

  function clearReview() {
    setFileIssues([]);
    setServerResults([]);
    setPreparedRows([]);
    setPage(0);
    setError('');
    setCursor(0);
    setRequestBase('');
    setCommitRows([]);
    setPreflightStarted(false);
    setFinished(false);
    setRefreshFailed(false);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    clearReview();
    setFileName(selected.name);
    setSheets([]);
    setSheetIndex(0);
    setMapping({ name: -1, surname: -1, email: -1, phone: -1 });
    setError('');
    if (selected.size > IMPORT_MAX_BYTES) {
      setError('Dosya en fazla 2 MB olabilir.');
      return;
    }
    setStage('reading');
    try {
      const result = await readContactFile(selected);
      if (!mounted.current) return;
      setSheets(result.sheets);
      const first = result.sheets[0];
      if (first) setMapping(inferImportMapping(first.headers));
      if (!result.sheets.length) setError('Dosyada kullanılabilir çalışma sayfası bulunamadı.');
    } catch (issue) {
      if (mounted.current) setError(issue instanceof Error ? issue.message : 'Dosya okunamadı.');
    } finally {
      if (mounted.current) setStage('idle');
    }
  }

  function changeSheet(next: number) {
    setSheetIndex(next);
    const nextSheet = sheets[next];
    setMapping(nextSheet ? inferImportMapping(nextSheet.headers) : { name: -1, surname: -1, email: -1, phone: -1 });
    clearReview();
  }

  function changeMapping(field: keyof ImportMapping, value: number) {
    setMapping((current) => ({ ...current, [field]: value }));
    clearReview();
  }

  async function runPreflight() {
    if (!prepared || !prepared.rows.length || busyLocal) return;
    clearReview();
    setPreflightStarted(true);
    setPreparedRows(prepared.rows);
    setFileIssues(prepared.issues);
    setStage('preflight');
    setError('');
    let offset = 0;
    try {
      while (offset < prepared.rows.length) {
        const batch = prepared.rows.slice(offset, offset + IMPORT_BATCH_SIZE);
        const result = await processImport(batch, false, '');
        if (!mounted.current) return;
        setServerResults((existing) => [...existing.filter((item) => !batch.some((row) => row.row === item.row)), ...result]);
        offset += batch.length;
        setCursor(offset);
      }
      if (mounted.current) setCursor(0);
    } catch (issue) {
      if (mounted.current) {
        setCursor(offset);
        setError(issue instanceof Error ? issue.message : 'Ön kontrol tamamlanamadı. Aynı paketten yeniden deneyin.');
      }
    } finally {
      if (mounted.current) setStage('idle');
    }
  }

  async function retryPreflight() {
    if (!prepared || busyLocal) return;
    setStage('preflight');
    setError('');
    let offset = cursor;
    try {
      while (offset < prepared.rows.length) {
        const batch = prepared.rows.slice(offset, offset + IMPORT_BATCH_SIZE);
        const result = await processImport(batch, false, '');
        if (!mounted.current) return;
        setServerResults((existing) => [...existing.filter((item) => !batch.some((row) => row.row === item.row)), ...result]);
        offset += batch.length;
        setCursor(offset);
      }
      if (mounted.current) setCursor(0);
    } catch (issue) {
      if (mounted.current) {
        setCursor(offset);
        setError(issue instanceof Error ? issue.message : 'Ön kontrol tamamlanamadı. Yeniden deneyin.');
      }
    } finally {
      if (mounted.current) setStage('idle');
    }
  }

  async function commitImport() {
    if (!prepared || busyLocal) return;
    const readyRows = commitRows.length ? commitRows : prepared.rows.filter((row) =>
      serverResults.some((result) => result.row === row.row && result.status === 'ready'));
    if (!readyRows.length) return;
    if (!commitRows.length) setCommitRows(readyRows);
    const base = requestBase || `${crypto.randomUUID()}:`;
    if (!requestBase) setRequestBase(base);
    setStage('importing');
    setError('');
    let offset = cursor;
    try {
      while (offset < readyRows.length) {
        const batch = readyRows.slice(offset, offset + IMPORT_BATCH_SIZE);
        const result = await processImport(batch, true, `${base}${offset}`);
        if (!mounted.current) return;
        setServerResults((existing) => [...existing.filter((item) => !batch.some((row) => row.row === item.row)), ...result]);
        offset += batch.length;
        setCursor(offset);
      }
      if (mounted.current) {
        setCursor(readyRows.length);
        const refreshed = await refresh();
        if (mounted.current) {
          setRefreshFailed(!refreshed);
          setFinished(true);
        }
      }
    } catch (issue) {
      if (mounted.current) {
        setCursor(offset);
        setError(issue instanceof Error ? issue.message : 'Paket onayı alınamadı. Aynı paketi güvenle yeniden deneyin.');
      }
    } finally {
      if (mounted.current) setStage('idle');
    }
  }

  const readyCount = serverResults.filter((item) => item.status === 'ready').length;
  const canPreflight = Boolean(prepared?.rows.length) && !busyLocal;
  const preflightIncomplete = preflightStarted && stage === 'idle' && serverResults.length < preparedRows.length && Boolean(error);
  const importIncomplete = Boolean(requestBase) && !finished && stage === 'idle' && Boolean(error);

  return (
    <section className="pt-bulk" aria-labelledby="pt-bulk-title">
      <header className="pt-bulk__head">
        <div>
          <span className="pt-bulk__eyebrow">04 / TOPLU KAYIT</span>
          <h2 id="pt-bulk-title">Dosyadan kişi aktar</h2>
          <p>CSV veya Excel dosyasını tarayıcıda kontrol edin; yalnızca açıkça onaylanan, uygun satırlar rehbere eklenir.</p>
        </div>
        <button type="button" className="pt-bulk__close" onClick={onClose} disabled={busyLocal} aria-label="Toplu aktarımı kapat">Kapat</button>
      </header>

      <div className="pt-bulk__privacy">
        <strong>Önce sunucu kontrolü, sonra ayrı onay.</strong>
        <span>Dosya bu tarayıcıda okunur. Önizleme mevcut ve arşivlenmiş kişilerle telefon/e-posta eşleşmelerini denetler. Kişi eklemek mesaj izni vermez; hiçbir ileti gönderilmez.</span>
      </div>

      <div className="pt-bulk__controls">
        <div className="pt-bulk__file">
          <input ref={fileInput} type="file" accept=".csv,.xlsx" onChange={(event) => void selectFile(event)} disabled={busyLocal} aria-label="CSV veya XLSX dosyası seç" />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busyLocal} className="pt-bulk__button pt-bulk__button--quiet">Dosya seç</button>
          <span className="pt-bulk__filename">{fileName || 'Henüz dosya seçilmedi'}</span>
        </div>
        <p className="pt-bulk__hint">En fazla 2 MB, 5.000 satır ve 10 çalışma sayfası. .xls dosyasını .xlsx biçimine dönüştürün. Uluslararası telefonlarda +ülke kodunu kullanın.</p>
      </div>

      {stage === 'reading' && <div className="pt-bulk__loading" role="status"><span /><span /><span />Dosya yerel olarak okunuyor…</div>}
      {error && (
        <div className="pt-bulk__error" role="alert">
          <div><strong>İşlem durdu</strong><span>{error}</span>
            {importIncomplete && <small>Önceki paketlerde kaydedilmiş kişiler olabilir. Devam, aynı paket kimliğiyle güvenle yeniden dener; sayım yalnızca sunucu yanıtından güncellenir.</small>}
            {preflightIncomplete && <small>Ön kontrol kaldığı yerden yeniden denenebilir; bu işlem kişi kaydetmez.</small>}
          </div>
          {importIncomplete && <button type="button" className="pt-bulk__button pt-bulk__button--primary" onClick={() => void commitImport()} disabled={busyLocal}>Aynı paketi yeniden dene</button>}
          {preflightIncomplete && <button type="button" className="pt-bulk__button pt-bulk__button--primary" onClick={() => void retryPreflight()} disabled={busyLocal}>Ön kontrolü sürdür</button>}
          {stage === 'idle' && sheets.length === 0 && <button type="button" className="pt-bulk__button pt-bulk__button--quiet" onClick={() => fileInput.current?.click()}>Dosyayı yeniden seç</button>}
        </div>
      )}

      {sheets.length > 0 && sheet && (
        <>
          <div className="pt-bulk__configuration">
            <label>Çalışma sayfası
              <select value={sheetIndex} onChange={(event) => changeSheet(Number(event.target.value))} disabled={busyLocal}>
                {sheets.map((item, index) => <option value={index} key={`${item.name}-${index}`}>{item.name}</option>)}
              </select>
            </label>
            <div className="pt-bulk__mapping-grid">
              {fieldNames.map(([field, label, optional]) => (
                <label key={field}>{label}{optional && <span> İsteğe bağlı</span>}
                  <select value={mapping[field]} onChange={(event) => changeMapping(field, Number(event.target.value))} disabled={busyLocal}>
                    <option value={-1}>{optional ? 'Eşleme yok' : 'Sütun seçin'}</option>
                    {sheet.headers.map((header, index) => <option key={`${index}-${header}`} value={index}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!prepared && <p className="pt-bulk__mapping-warning">Ad ve soyad sütunlarını ve en az bir iletişim sütununu eşleyin. Her alan ayrı bir sütunda olmalı.</p>}
            {prepared && !prepared.rows.length && <p className="pt-bulk__mapping-warning">Bu eşlemeyle sunucu kontrolüne gönderilebilecek uygun satır yok. Dosya içi sorunları aşağıda inceleyin.</p>}
            <div className="pt-bulk__actions">
              <button type="button" className="pt-bulk__button pt-bulk__button--quiet" onClick={() => void runPreflight()} disabled={!canPreflight}>
                {stage === 'preflight' ? `Sunucu kontrolü ${numberFormat.format(cursor)} / ${numberFormat.format(prepared?.rows.length ?? 0)}` : 'Sunucu ön kontrolünü çalıştır'}
              </button>
              {prepared && fileIssues.length > 0 && <span>{numberFormat.format(fileIssues.length)} dosya içi satır atlandı</span>}
            </div>
          </div>

          <div className="pt-bulk__results">
            <div className="pt-bulk__summary" aria-live="polite">
              <div><strong>{numberFormat.format(prepared?.total ?? 0)}</strong><span>dosya satırı</span></div>
              <div><strong>{numberFormat.format(counts.ready)}</strong><span>sunucuda uygun</span></div>
              <div><strong>{numberFormat.format(counts.imported)}</strong><span>kaydedildi</span></div>
              <div><strong>{numberFormat.format(counts.duplicate)}</strong><span>yinelenen</span></div>
              <div><strong>{numberFormat.format(counts.invalid)}</strong><span>hatalı</span></div>
            </div>
            {allRows.length === 0 ? (
              <div className="pt-bulk__empty"><strong>Gösterilecek satır yok</strong><span>Başlık satırını ve en az bir kişi satırını içeren CSV veya XLSX dosyası seçin.</span></div>
            ) : (
              <>
                <div className="pt-bulk__table-wrap">
                  <table className="pt-bulk__table">
                    <thead><tr><th>Satır</th><th>Ad / unvan</th><th>E-posta</th><th>Telefon</th><th>Durum / sorun</th></tr></thead>
                    <tbody>{visibleRows.map((item) => (
                      <tr key={item.row}>
                        <td>{item.row}</td><td>{item.name || '—'}</td><td>{item.email || '—'}</td><td>{item.phone || '—'}</td>
                        <td><span className={`pt-bulk__status pt-bulk__status--${item.status}`}>{statusLabel(item.status)}</span>{item.reason && <small>{item.reason}</small>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <nav className="pt-bulk__pagination" aria-label="İçe aktarım satırları">
                  <span>{numberFormat.format(page * PAGE_SIZE + 1)}–{numberFormat.format(Math.min((page + 1) * PAGE_SIZE, allRows.length))} / {numberFormat.format(allRows.length)}</span>
                  <div>
                    <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Önceki</button>
                    <span>{page + 1} / {pages}</span>
                    <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>Sonraki</button>
                  </div>
                </nav>
              </>
            )}
            {prepared?.total === 0 && <div className="pt-bulk__empty"><strong>Dosyada kişi satırı yok</strong><span>Kontrol ettiğiniz sayfada yalnızca başlıklar veya boş satırlar var.</span></div>}
          </div>

          <div className="pt-bulk__commit">
            <p>{finished
              ? refreshFailed
                ? 'Tüm paketler sunucu tarafından onaylandı. Rehber görünümü yenilenemedi; “Yenile” ile durumu alın.'
                : 'Tüm paketler sunucu tarafından onaylandı. Rehber yenilendi.'
              : readyCount > 0
                ? `${numberFormat.format(readyCount)} sunucuda uygun satır için aktarımı ayrıca onaylayın. Dosya içi hatalı ve yinelenen satırlar atlanır.`
                : 'Kayıt öncesi sunucu ön kontrolünü çalıştırın. Sunucu her satırı yeniden doğrular.'}</p>
            {finished
              ? <span className="pt-bulk__complete">Aktarım tamamlandı</span>
              : <button type="button" className="pt-bulk__button pt-bulk__button--primary" onClick={() => void commitImport()} disabled={busyLocal || readyCount === 0 || serverResults.length < preparedRows.length}>
                {stage === 'importing' ? `Kaydediliyor ${numberFormat.format(cursor)} / ${numberFormat.format(preparedRows.filter((row) => serverResults.some((result) => result.row === row.row && result.status !== 'ready')).length + readyCount)}` : 'Uygun satırları içe aktar'}
              </button>}
          </div>
        </>
      )}
    </section>
  );
}