type ImageClipboardEnvironment = {
  baseUrl: string;
  fetchImage: typeof fetch;
  clipboard: Pick<Clipboard, 'write'> | undefined;
  ClipboardItemCtor: typeof ClipboardItem | undefined;
  createBitmap: typeof createImageBitmap | undefined;
  createCanvas: () => HTMLCanvasElement;
};

function browserEnvironment(): ImageClipboardEnvironment {
  return {
    baseUrl: window.location.href,
    fetchImage: window.fetch.bind(window),
    clipboard: navigator.clipboard,
    ClipboardItemCtor: globalThis.ClipboardItem,
    createBitmap: globalThis.createImageBitmap,
    createCanvas: () => document.createElement('canvas'),
  };
}

async function pngFromImage(blob: Blob, env: ImageClipboardEnvironment): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  if (!env.createBitmap) throw new Error('Tarayıcınız bu fotoğraf biçimini kopyalamayı desteklemiyor.');
  const bitmap = await env.createBitmap(blob);
  try {
    const canvas = env.createCanvas();
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Fotoğraf işlenemedi.');
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Fotoğraf PNG biçimine dönüştürülemedi.')), 'image/png');
    });
  } finally {
    bitmap.close();
  }
}

// Pass the image promise to ClipboardItem before awaiting the network request:
// browsers require clipboard.write to start in the user's click gesture.
export function copyListingImage(imageUrl: string, env: ImageClipboardEnvironment = browserEnvironment()): Promise<void> {
  if (!env.clipboard?.write || !env.ClipboardItemCtor) {
    throw new Error('Tarayıcınız fotoğrafı panoya kopyalamayı desteklemiyor.');
  }
  let url: URL;
  try { url = new URL(imageUrl, env.baseUrl); }
  catch { throw new Error('Fotoğraf adresi geçersiz.'); }
  if (!['https:', 'blob:', 'data:'].includes(url.protocol) && !(url.protocol === 'http:' && url.origin === new URL(env.baseUrl).origin)) {
    throw new Error('Fotoğraf adresi güvenli değil.');
  }
  if (url.protocol === 'data:' && !/^data:image\/(jpeg|png|webp|gif);base64,/i.test(imageUrl)) {
    throw new Error('Fotoğraf adresi desteklenmiyor.');
  }
  const png = env.fetchImage(url.toString(), { mode: 'cors', credentials: 'omit' }).then(async response => {
    if (!response.ok) throw new Error('Fotoğraf adresine erişilemedi.');
    const blob = await response.blob();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type) || !blob.size || blob.size > 20 * 1024 * 1024) {
      throw new Error('Fotoğraf biçimi desteklenmiyor veya dosya çok büyük.');
    }
    return pngFromImage(blob, env);
  });
  return env.clipboard.write([new env.ClipboardItemCtor({ 'image/png': png })]);
}
