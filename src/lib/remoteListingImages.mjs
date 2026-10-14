import {listingFilePreviews} from './listingMedia.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const FORMAT_ERROR = 'Doğrudan bir JPEG, PNG, WebP veya GIF fotoğraf adresi kullanın. Fotoğraf en fazla 2 MB olabilir.';

export function clipboardImageFiles(data) {
  const files = Array.from(data?.files || []).filter(file => file.type.startsWith('image/'));
  if (files.length) return files;
  return Array.from(data?.items || [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter(Boolean);
}

export async function readClipboardImages(clipboard = globalThis.navigator?.clipboard) {
  if (typeof clipboard?.read !== 'function') {
    throw new Error('Tarayıcınız panodan okumayı desteklemiyor. Aşağıdaki yapıştırma alanını kullanın.');
  }
  let items;
  try { items = await clipboard.read(); }
  catch { throw new Error('Panoya erişim izni verilmedi. Aşağıdaki alana Ctrl+V ile veya uzun basıp Yapıştır seçerek fotoğrafı ekleyin.'); }
  const files = [];
  for (const item of items) {
    const type = item.types.find(value => TYPES.includes(value));
    if (type) files.push(await item.getType(type));
  }
  if (!files.length) throw new Error('Panoda fotoğraf yok. Kaynak sitede “Resmi kopyala” seçeneğini kullanın; “Resim adresini kopyala” seçeneğiyle alınan bağlantıyı adres alanına yapıştırın.');
  return listingFilePreviews(files);
}

export async function imagePreviewFromUrl(value, fetchImage = globalThis.fetch) {
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error('Geçerli bir https:// fotoğraf adresi girin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 2048) {
    throw new Error('Geçerli bir https:// fotoğraf adresi girin.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let response;
    try {
      response = await fetchImage(url.href, {
        mode: 'cors', credentials: 'omit', redirect: 'follow', signal: controller.signal,
      });
    } catch {
      throw new Error('Fotoğraf indirilemedi. Kaynak site adresinden indirmeyi engelliyor olabilir. Fotoğrafın kendisini kopyalayıp aşağıdaki alana yapıştırabilirsiniz.');
    }
    if (!response.ok) throw new Error('Fotoğraf adresi açılamadı. Adresi ve erişim iznini kontrol edin.');
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!TYPES.includes(type) || Number(response.headers.get('content-length')) > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error(FORMAT_ERROR);
    }
    // Bound downloads even when the source omits or lies about Content-Length.
    const chunks = [];
    let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const {done, value: chunk} = await reader.read();
          if (done) break;
          size += chunk.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            throw new Error(FORMAT_ERROR);
          }
          chunks.push(chunk);
        }
      } finally { reader.releaseLock(); }
    } else {
      const blob = await response.blob();
      if (blob.size > MAX_BYTES) throw new Error(FORMAT_ERROR);
      chunks.push(blob);
    }
    const blob = new Blob(chunks, {type});
    if (!blob.size) throw new Error('Fotoğraf dosyası boş.');
    const [preview] = await listingFilePreviews([blob]);
    return preview;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Fotoğraf indirme süresi doldu. Tekrar deneyin veya fotoğrafın kendisini kopyalayıp yapıştırın.');
    throw error;
  } finally { clearTimeout(timer); }
}
