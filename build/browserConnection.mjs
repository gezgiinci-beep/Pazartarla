// Build-time browser settings only; never substitute privileged credentials.
export function browserConnection(environment, fileEnvironment = {}) {
  const url = environment.VITE_SUPABASE_URL || fileEnvironment.VITE_SUPABASE_URL || '';
  const key = environment.VITE_SUPABASE_ANON_KEY || environment.SUPABASE_PUBLISHABLE_KEY ||
    fileEnvironment.VITE_SUPABASE_ANON_KEY || '';
  return {
    url: typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '',
    key: typeof key === 'string' ? key.trim() : '',
  };
}

export function requireBuildConnection(connection) {
  if (!connection.url || !connection.key) {
    throw new Error('Yayın derlemesi durduruldu: VITE_SUPABASE_URL ve tarayıcı anahtarı (VITE_SUPABASE_ANON_KEY veya SUPABASE_PUBLISHABLE_KEY) eksik. Gizli servis anahtarı kullanmayın.');
  }
  let address;
  try { address = new URL(connection.url); }
  catch { throw new Error('Yayın derlemesi durduruldu: VITE_SUPABASE_URL geçerli bir sunucu adresi olmalı.'); }
  if (!['https:', 'http:'].includes(address.protocol) || address.username || address.password || address.search || address.hash) {
    throw new Error('Yayın derlemesi durduruldu: VITE_SUPABASE_URL geçerli bir sunucu adresi olmalı.');
  }
  if (connection.key.startsWith('sb_secret_')) {
    throw new Error('Yayın derlemesi durduruldu: gizli servis anahtarı tarayıcıda kullanılamaz.');
  }
  if (connection.key.split('.').length === 3) {
    let payload;
    try { payload = JSON.parse(Buffer.from(connection.key.split('.')[1], 'base64url').toString('utf8')); }
    catch { throw new Error('Yayın derlemesi durduruldu: tarayıcı anahtarı geçersiz.'); }
    if (payload.role !== 'anon') {
      throw new Error('Yayın derlemesi durduruldu: yalnız anonim veya yayınlanabilir tarayıcı anahtarı kullanılmalı.');
    }
  }
}
