import { createHash } from 'node:crypto';
import { createTursoConnection } from './turso.js';
import { isSameOrigin, parseJsonBody } from './tursoAuth.js';
import { authenticateTursoAdmin, setPrivateJsonHeaders } from './tursoAdminAccess.js';

const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;
const TYPES = new Map([
  ['image/jpeg', ['jpg', 'image']],
  ['image/png', ['png', 'image']],
  ['image/webp', ['webp', 'image']],
  ['video/mp4', ['mp4', 'video']],
  ['video/webm', ['webm', 'video']],
]);

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function header(request, key) {
  return typeof request.headers?.get === 'function'
    ? request.headers.get(key)
    : request.headers?.[key.toLowerCase()] ?? request.headers?.[key];
}

async function readBody(request) {
  const declared = Number(header(request, 'content-length'));
  if (Number.isFinite(declared) && declared > VIDEO_LIMIT) fail('AD_MEDIA_TOO_LARGE', 413);
  if (Buffer.isBuffer(request.body) || request.body instanceof Uint8Array) {
    const buffer = Buffer.from(request.body);
    if (buffer.length > VIDEO_LIMIT) fail('AD_MEDIA_TOO_LARGE', 413);
    return buffer;
  }
  if (typeof request[Symbol.asyncIterator] !== 'function') fail('AD_MEDIA_INVALID');
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > VIDEO_LIMIT) fail('AD_MEDIA_TOO_LARGE', 413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, length);
}

function verifiedType(bytes, headerType) {
  const contentType = String(headerType || '').split(';', 1)[0].trim().toLowerCase();
  const details = TYPES.get(contentType);
  if (!details || !bytes.length) fail('AD_MEDIA_INVALID');
  const [extension, mediaType] = details;
  const valid = contentType === 'image/jpeg'
    ? bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9
    : contentType === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : contentType === 'image/webp'
        ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        : contentType === 'video/mp4'
          ? bytes.toString('ascii', 4, 8) === 'ftyp'
          : bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!valid) fail('AD_MEDIA_INVALID');
  const maximum = mediaType === 'video' ? VIDEO_LIMIT : IMAGE_LIMIT;
  if (bytes.length > maximum) fail('AD_MEDIA_TOO_LARGE', 413);
  return { extension, mediaType, contentType };
}

function checkedBlobUrl(value, pathname) {
  let url;
  try { url = new URL(value); } catch { throw new Error('AD_BLOB_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      decodeURIComponent(url.pathname.replace(/^\/+/, '')) !== pathname) {
    throw new Error('AD_BLOB_URL_INVALID');
  }
  return url.href;
}

export function createTursoAdvertisementMediaUploadHandler({
  connect = createTursoConnection,
  authenticate = authenticateTursoAdmin,
  putBlob,
  storageConfigured = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN),
  now = () => new Date(),
} = {}) {
  return async function tursoAdvertisementMediaUploadHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return response.status(403).json({ error: 'origin_not_allowed' });
    if (!(typeof storageConfigured === 'function' ? storageConfigured() : storageConfigured) ||
        typeof putBlob !== 'function') {
      return response.status(503).json({ error: 'AD_MEDIA_STORAGE_REQUIRED' });
    }
    try {
      const access = await authenticate(request, { connect, now });
      if (access.status) return response.status(access.status).json({ error: access.error });
      const id = request.query?.id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))) {
        return response.status(400).json({ error: 'AD_INVALID' });
      }
      const bytes = await readBody(request);
      const media = verifiedType(bytes, header(request, 'content-type'));
      const pathname = `${id}/${cryptoRandomId()}.${media.extension}`;
      const blob = await putBlob(pathname, bytes, {
        access: 'public',
        contentType: media.contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      const mediaPath = checkedBlobUrl(blob?.url, pathname);
      return response.status(201).json({
        media_path: mediaPath,
        media_type: media.mediaType,
        size_bytes: bytes.length,
        digest: createHash('sha256').update(bytes).digest('hex'),
      });
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      const code = /^AD_MEDIA_[A-Z_]+$/.test(String(error?.code || ''))
        ? error.code
        : error?.message === 'AD_BLOB_URL_INVALID' ? 'AD_MEDIA_UNAVAILABLE' : 'AD_MEDIA_UNAVAILABLE';
      if (status === 429 || status === 402) response.setHeader('Retry-After', '300');
      return response.status(status).json({ error: code });
    }
  };
}

function cryptoRandomId() {
  return globalThis.crypto.randomUUID();
}

export function createTursoAdvertisementMediaDeleteHandler({
  connect = createTursoConnection,
  authenticate = authenticateTursoAdmin,
  deleteBlob,
  now = () => new Date(),
} = {}) {
  return async function tursoAdvertisementMediaDeleteHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return response.status(403).json({ error: 'origin_not_allowed' });
    if (typeof deleteBlob !== 'function') return response.status(503).json({ error: 'AD_MEDIA_UNAVAILABLE' });
    try {
      const access = await authenticate(request, { connect, now });
      if (access.status) return response.status(access.status).json({ error: access.error });
      const payload = parseJsonBody(request);
      if (typeof payload?.url !== 'string') return response.status(400).json({ error: 'AD_MEDIA_INVALID' });
      let url;
      try { url = new URL(payload.url); } catch { return response.status(400).json({ error: 'AD_MEDIA_INVALID' }); }
      const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      if (url.protocol !== 'https:' || url.username || url.password ||
          !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
          !/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp|mp4|webm)$/i.test(path) ||
          url.search || url.hash) {
        return response.status(400).json({ error: 'AD_MEDIA_INVALID' });
      }
      const referenced = await access.database.get(
        'SELECT 1 AS used FROM advertisements WHERE media_path = ? LIMIT 1',
        url.href,
      );
      if (referenced) return response.status(409).json({ error: 'AD_MEDIA_IN_USE' });
      await deleteBlob(url.href);
      return response.status(200).json({ deleted: true });
    } catch {
      return response.status(503).json({ error: 'AD_MEDIA_UNAVAILABLE' });
    }
  };
}
