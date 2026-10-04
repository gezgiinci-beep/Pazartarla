import type { useSiteSettings } from '../hooks/useSiteSettings';

export default function SiteSettingsStatus({
  state, admin = false
}: { state: ReturnType<typeof useSiteSettings>; admin?: boolean }) {
  const error = state.loadError || (admin ? state.saveError : '');
  const status = state.loading ? 'Site ayarları yükleniyor...' :
    admin && state.saving ? 'Değişiklik sunucuya kaydediliyor...' :
    admin ? state.success : '';
  if (!error && !status) return null;
  return (
    <div style={{ backgroundColor: error ? '#fef2f2' : '#f0fdf4', color: error ? '#991b1b' : '#166534', borderRadius: '8px', padding: '10px', marginBottom: '10px', fontSize: '12px' }}>
      {error && <div role="alert">{error}</div>}
      {status && <div role="status">{status}</div>}
      {state.loadError && (
        <button type="button" onClick={() => void state.refresh()} disabled={state.loading || state.saving} style={{ marginTop: '6px', padding: '6px 10px', cursor: 'pointer' }}>
          Ayarları Yeniden Yükle
        </button>
      )}
    </div>
  );
}