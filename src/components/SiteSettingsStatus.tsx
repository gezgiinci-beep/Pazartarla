import type { useSiteSettings } from '../hooks/useSiteSettings';

export default function SiteSettingsStatus({
  state, admin = false
}: { state: ReturnType<typeof useSiteSettings>; admin?: boolean }) {
  if (!admin) return null;
  const error = state.loadError || state.saveError;
  const warning = state.loadWarning;
  const status = state.loading ? 'Site ayarları yükleniyor...' :
    state.saving ? 'Değişiklik sunucuya kaydediliyor...' : state.success;
  if (!error && !warning && !status) return null;
  const color = error ? '#991b1b' : warning ? '#854d0e' : '#166534';
  const backgroundColor = error ? '#fef2f2' : warning ? '#fffbeb' : '#f0fdf4';
  return (
    <div style={{ backgroundColor, color, borderRadius: '8px', padding: '10px', marginBottom: '10px', fontSize: '12px' }}>
      {error && <div role="alert">{error}</div>}
      {warning && <div role="status">{warning}</div>}
      {status && <div role="status">{status}</div>}
      {state.loadError && (
        <button type="button" onClick={() => void state.refresh()} disabled={state.loading || state.saving} style={{ marginTop: '6px', padding: '6px 10px', cursor: 'pointer' }}>
          Ayarları Yeniden Yükle
        </button>
      )}
    </div>
  );
}