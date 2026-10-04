export const EDIT_FIELDS = ['title','price','category','subCategory','location','description','seller','phone'] as const;
export function listingDraft(row: any): Record<string,string> {
  return Object.fromEntries(EDIT_FIELDS.map(key => [key,String(row[key] ?? '')]));
}
export function listingChanges(original: any,draft: Record<string,string>) {
  const changes: Record<string,string|number> = {};
  for (const key of EDIT_FIELDS) {
    if (key !== 'price' && String(draft[key] ?? '') === String(original[key] ?? '')) continue;
    const value = key === 'price' ? Number(draft[key]) : String(draft[key] ?? '').trim();
    const before = key === 'price' ? Number(original[key]) : String(original[key] ?? '');
    if (value !== before) changes[key] = value;
  }
  if (!draft.price.trim() || !Number.isFinite(Number(draft.price)) || Number(draft.price)<0)
    throw new Error('LISTING_EDIT_INVALID');
  return changes;
}
export function editError(error: any): string {
  const message = String(error?.message || '');
  if (error?.code === '40001' || message.includes('CONFLICT'))
    return 'İlan başka bir oturumda değiştirildi. Taslağınız korundu; güncel ilanı yeniden yükleyip değişikliklerinizi kontrol edin.';
  if (error?.code === '42501' || message.includes('FORBIDDEN'))
    return 'Bu ilanı düzenleme yetkiniz yok veya ilan arşivlenmiş. İlan sahibi olarak giriş yapın.';
  if (error?.code === 'PGRST202' || error?.code === '42883')
    return 'İlan düzenleme sunucuda henüz etkinleştirilmemiş. Yöneticiyle iletişime geçin.';
  if (error?.code === '22023' || message.includes('INVALID'))
    return 'Alanları kontrol edin: başlık, fiyat, satıcı, telefon ve geçerli kategori gereklidir.';
  return 'İlan kaydedilemedi. Taslağınız korundu; yeniden deneyin.';
}