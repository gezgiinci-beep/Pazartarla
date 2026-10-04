// A successful HTTP status alone is not proof that RLS allowed a deletion.
// Require the exact row echoed by PostgREST before removing it from the UI.
export async function deleteAdminListing(url: string, headers: Record<string,string>, id: number) {
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