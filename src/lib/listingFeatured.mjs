// Featured placement is independent of the photo-storage rollout.
export async function setListingFeatured(client, id, featured) {
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
  if (error?.code === 'PGRST202' || error?.code === '42883')
    return 'Vitrin işlemi canlı sunucuda henüz etkinleştirilmemiş. Bu bir ilan onayı isteği değildir.';
  if (error?.code === '42501')
    return 'Vitrin değişikliği için sunucunun doğruladığı yönetici oturumu gerekir. Yönetici hesabınızla yeniden giriş yapın.';
  if (error?.code === '40001')
    return 'İlan başka bir oturumda değişti. Listeyi yenileyip vitrin işlemini tekrar deneyin.';
  return 'Vitrin değişikliği doğrulanamadı. Listeyi yenileyip durumunu kontrol edin.';
}
