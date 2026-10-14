// Featured placement is independent of the photo-storage rollout.
const TURSO_AUTH_ENABLED = import.meta.env?.VITE_AUTH_BACKEND === 'turso';
const API_BASE = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
export async function setListingFeatured(client, id, featured) {
  if (TURSO_AUTH_ENABLED) {
    const path = `${API_BASE}/api/listing-moderation?id=${encodeURIComponent(id)}`;
    const snapshotResponse = await fetch(path, {credentials:'same-origin',cache:'no-store'});
    const snapshot = await snapshotResponse.json().catch(()=>({}));
    if (!snapshotResponse.ok || snapshot?.listing?.id !== id ||
        !/^[a-f0-9]{64}$/.test(snapshot.edit_token || '')) {
      throw new Error(snapshot?.error || 'LISTING_FEATURE_READBACK_FAILED');
    }
    const response = await fetch(`${API_BASE}/api/listing-moderation`, {
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({id,decision:'set_featured',featured,edit_token:snapshot.edit_token}),
    });
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(result?.error || 'LISTING_FEATURE_READBACK_FAILED');
    if (result?.listing?.id !== id || Boolean(result.listing.is_featured) !== featured)
      throw new Error('LISTING_FEATURE_READBACK_FAILED');
    return result.listing;
  }
  const snapshot = await client.rpc('get_listing_featured_snapshot', {p_listing_id: id});
  if (snapshot.error) throw snapshot.error;
  if (snapshot.data?.listing?.id !== id || !/^[a-f0-9]{64}$/.test(snapshot.data.edit_token))
    throw new Error('LISTING_FEATURE_READBACK_FAILED');
  const saved = await client.rpc('set_listing_featured', {
    p_listing_id: id, p_featured: featured, p_edit_token: snapshot.data.edit_token
  });
  if (saved.error) throw saved.error;
  if (saved.data?.listing?.id !== id || saved.data.listing.is_featured !== featured)
    throw new Error('LISTING_FEATURE_READBACK_FAILED');
  return saved.data.listing;
}

export function featuredError(error) {
  if (error?.message === 'LISTING_ADMIN_REAUTH_REQUIRED')
    return 'Yönetici doğrulaması zaman aşımına uğradı. Yönetici hesabınızla yeniden giriş yapın.';
  if (error?.message === 'LISTING_EDIT_CONFLICT')
    return 'İlan başka bir oturumda değişti. Listeyi yenileyip vitrin işlemini tekrar deneyin.';
  if (error?.code === 'PGRST202' || error?.code === '42883')
    return 'Vitrin işlemi canlı sunucuda henüz etkinleştirilmemiş. Bu bir ilan onayı isteği değildir.';
  if (error?.code === '42501')
    return 'Vitrin değişikliği için sunucunun doğruladığı yönetici oturumu gerekir. Yönetici hesabınızla yeniden giriş yapın.';
  if (error?.code === '40001')
    return 'İlan başka bir oturumda değişti. Listeyi yenileyip vitrin işlemini tekrar deneyin.';
  return 'Vitrin değişikliği doğrulanamadı. Listeyi yenileyip durumunu kontrol edin.';
}
