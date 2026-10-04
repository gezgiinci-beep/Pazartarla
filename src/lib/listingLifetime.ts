const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric'
});
export function formatListingDate(value: unknown): string {
  const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? dateFormatter.format(timestamp) : 'Tarih bilgisi yok';
}
export function isListingArchived(row: { expires_at?: string | null }, now = Date.now()): boolean {
  const expires = typeof row.expires_at === 'string' ? Date.parse(row.expires_at) : NaN;
  return Number.isFinite(expires) && expires <= now;
}