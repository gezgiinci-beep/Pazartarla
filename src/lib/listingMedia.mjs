// Legacy decoding is read-only during the staged rollout. New writes never
// serialize metadata into SEO tags. Remove the decoder only after live verification.
export const LISTING_META_MARKER = '\\n__PAZARTARLA_META_V1__:';
export const LISTING_MEDIA_BUCKET = 'listing-media';
export const DEFAULT_LISTING_IMAGE = 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800';

export function legacyListingMetadata(row) {
  const raw = row.seotags ?? '';
  const index = raw.lastIndexOf(LISTING_META_MARKER);
  let metadata = {};
  let seoTags = raw;
  if (index >= 0) {
    // Do not silently remove malformed metadata or hide a missing photo.
    metadata = JSON.parse(decodeURIComponent(raw.slice(index + LISTING_META_MARKER.length)));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
      throw new Error('LISTING_METADATA_INVALID');
    seoTags = raw.slice(0, index);
  }
  const images = Array.isArray(metadata.images)
    ? metadata.images.filter(value => typeof value === 'string' && value.trim())
    : [];
  return {seoTags, images: images.length ? images : row.image ? [row.image] : [],
    isFeatured: metadata.isFeatured === true, hasSuffix: index >= 0};
}

export function mediaReference(value, baseUrl) {
  const prefix = baseUrl.replace(/\/$/, '') + '/storage/v1/object/public/';
  if (value.startsWith(prefix + LISTING_MEDIA_BUCKET + '/')) {
    return mediaReference(decodeURIComponent(value.slice(prefix.length)), baseUrl);
  }
  if (value.startsWith(LISTING_MEDIA_BUCKET + '/')) {
    if (!/^listing-media\/(?:[a-f0-9-]{36}|migrated\/[0-9]+)\/[a-zA-Z0-9._-]+$/.test(value))
      throw new Error('LISTING_MEDIA_INVALID');
    return value;
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 2048)
    throw new Error('LISTING_MEDIA_INVALID');
  return value;
}

export function listingImageUrl(reference, baseUrl) {
  return reference.startsWith(LISTING_MEDIA_BUCKET + '/')
    ? baseUrl.replace(/\/$/, '') + '/storage/v1/object/public/' +
      reference.split('/').map(encodeURIComponent).join('/')
    : reference;
}

export function readListingMedia(row, baseUrl) {
  const legacy = legacyListingMetadata(row);
  const refs = Array.isArray(row.gallery_paths) ? row.gallery_paths : legacy.images;
  return {images: refs.map(ref => listingImageUrl(ref, baseUrl)),
    seoTags: legacy.seoTags,
    isFeatured: typeof row.is_featured === 'boolean' ? row.is_featured : legacy.isFeatured};
}

export function imageData(value, maxBytes = 2 * 1024 * 1024) {
  const match = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil(maxBytes / 3) * 4)
    throw new Error('LISTING_IMAGE_INVALID');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const hex = [...bytes.slice(0, 12)].map(n => n.toString(16).padStart(2, '0')).join('');
  const valid = match[1] === 'jpeg' ? hex.startsWith('ffd8ff')
    : match[1] === 'png' ? hex.startsWith('89504e470d0a1a0a')
    : match[1] === 'gif' ? hex.startsWith('474946383761') || hex.startsWith('474946383961')
    : hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
  if (!valid || bytes.length > maxBytes) throw new Error('LISTING_IMAGE_INVALID');
  return {bytes, contentType: 'image/' + match[1], extension: match[1] === 'jpeg' ? 'jpg' : match[1]};
}

export function assertSavedMedia(row, expected) {
  if (!row || Object.entries(expected).some(([key, value]) =>
    JSON.stringify(row[key]) !== JSON.stringify(value))) {
    throw new Error('LISTING_MEDIA_READBACK_FAILED');
  }
}

export async function listingFilePreviews(files) {
  return Promise.all(files.map(file => {
    if (file.size > 2 * 1024 * 1024 || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))
      throw new Error('Fotoğraflar JPEG, PNG, WebP veya GIF biçiminde ve en fazla 2 MB olmalıdır.');
    return new Promise((resolve,reject) => {
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Fotoğraf okunamadı.'));
      reader.onload=()=>{
        try { imageData(reader.result); resolve(reader.result); }
        catch { reject(new Error('Fotoğraf biçimi geçersiz.')); }
      };
      reader.readAsDataURL(file);
    });
  }));
}

// Preserve successful uploads across retry, including a partial upload failure.
// Never delete on uncertain listing-save outcomes: the server may have committed.
const pendingUploads = new Map();
export async function persistListingImages(images, {client, baseUrl, userId}) {
  if (!userId || !Array.isArray(images) || images.length > 10) throw new Error('LISTING_MEDIA_INVALID');
  const refs = [];
  for (const value of images) {
    if (!value.startsWith('data:')) {
      refs.push(mediaReference(value, baseUrl));
      continue;
    }
    const {bytes, contentType, extension} = imageData(value);
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(n => n.toString(16).padStart(2, '0')).join('');
    const key = userId + ':' + digest;
    let path = pendingUploads.get(key);
    if (!path) {
      path = userId + '/' + crypto.randomUUID() + '.' + extension;
      const {data, error} = await client.storage.from(LISTING_MEDIA_BUCKET)
        .upload(path, new Blob([bytes], {type: contentType}), {contentType, upsert: false});
      if (error) throw error;
      if (data?.path !== path) throw new Error('LISTING_MEDIA_UPLOAD_UNCONFIRMED');
      pendingUploads.set(key, path);
    }
    refs.push(LISTING_MEDIA_BUCKET + '/' + path);
  }
  const urls = refs.map(ref => listingImageUrl(ref, baseUrl));
  return {gallery_paths: refs, image: urls[0] || DEFAULT_LISTING_IMAGE, images: urls};
}