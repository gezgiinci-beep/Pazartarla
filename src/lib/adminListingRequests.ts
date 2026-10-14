// A successful HTTP status alone is not proof that RLS allowed a deletion.
// Require the exact row echoed by PostgREST before removing it from the UI.
const API_BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
export async function deleteAdminListing(url: string, headers: Record<string,string>, id: number, useTurso = false) {
  if (useTurso) {
    const response = await fetch(`${API_BASE}/api/listing-moderation`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id, decision: 'delete' }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const result = await response.json();
    if (result?.deleted_id !== id) throw new Error('Sunucu ilanı silmedi.');
    return;
  }
  const response = await fetch(url + '/rest/v1/listings?id=eq.' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=representation' }
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== id) {
    throw new Error('Sunucu ilanı silmedi.');
  }
}