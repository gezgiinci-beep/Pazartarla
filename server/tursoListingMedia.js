import {createHash, createHmac} from 'node:crypto';
import {imageData} from '../src/lib/listingMedia.mjs';
import {createTursoConnection} from './turso.js';
import {getAuthSession, getSessionSecret, isSameOrigin} from './tursoAuth.js';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function setPrivateJsonHeaders(response) {
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Vary', 'Cookie');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function requestHeader(request, name) {
  const headers = request.headers;
  return typeof headers?.get === 'function'
    ? headers.get(name)
    : headers?.[name.toLowerCase()] ?? headers?.[name];
}

function secretValue(provider) {
  const value = typeof provider === 'function' ? provider() : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value : null;
}

function httpError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

async function readImageBody(request) {
  const declaredLength = Number(requestHeader(request, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
    throw httpError('LISTING_IMAGE_TOO_LARGE', 413);
  }

  const chunks = [];
  let length = 0;
  if (Buffer.isBuffer(request.body) || request.body instanceof Uint8Array) {
    const body = Buffer.from(request.body);
    if (body.length > MAX_IMAGE_BYTES) throw httpError('LISTING_IMAGE_TOO_LARGE', 413);
    return body;
  }

  if (typeof request[Symbol.asyncIterator] !== 'function') {
    throw httpError('LISTING_IMAGE_INVALID', 400);
  }
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    length += chunk.length;
    if (length > MAX_IMAGE_BYTES) throw httpError('LISTING_IMAGE_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

function validatedImage(bytes, requestContentType) {
  const contentType = String(requestContentType || '').split(';', 1)[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType) || !bytes.length) {
    throw httpError('LISTING_IMAGE_INVALID', 400);
  }
  let decoded;
  try {
    decoded = imageData(`data:${contentType};base64,${bytes.toString('base64')}`, MAX_IMAGE_BYTES);
  } catch {
    throw httpError('LISTING_IMAGE_INVALID', 400);
  }
  if (decoded.contentType !== contentType || !Buffer.from(decoded.bytes).equals(bytes)) {
    throw httpError('LISTING_IMAGE_INVALID', 400);
  }
  return decoded;
}

function publicBlobUrl(value, expectedPathname) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Blob returned an invalid URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      url.pathname.replace(/^\/+/, '') !== expectedPathname) {
    throw new Error('Blob returned an unexpected URL');
  }
  return url.href;
}

export function createTursoListingMediaUploadHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  mutationsEnabled = () => process.env.PAZARTARLA_LISTING_MUTATIONS_BACKEND === 'turso',
  mediaEnabled = () => process.env.PAZARTARLA_LISTING_MEDIA_BACKEND === 'vercel_blob',
  storageConfigured = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN),
  secretProvider,
  getSession = getAuthSession,
  putBlob,
  now = () => new Date(),
} = {}) {
  return async function tursoListingMediaUploadHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({error: 'method_not_allowed'});
    }
    if (!isSameOrigin(request)) {
      return response.status(403).json({error: 'origin_not_allowed'});
    }

    const isEnabled = (value) => typeof value === 'function' ? value() : value;
    if (!isEnabled(authEnabled) || !isEnabled(mutationsEnabled) ||
        !isEnabled(mediaEnabled) || !isEnabled(storageConfigured) ||
        typeof putBlob !== 'function') {
      return response.status(503).json({error: 'LISTING_MEDIA_STORAGE_REQUIRED'});
    }

    try {
      const database = connect();
      const currentTime = now();
      const sessionSecret = secretValue(secretProvider);
      if (!sessionSecret) return response.status(503).json({error: 'auth_unavailable'});
      const session = await getSession(database, request, sessionSecret, currentTime);
      if (!session?.user?.id || !session.user.email_confirmed_at ||
          session.user.is_anonymous === true) {
        return response.status(401).json({error: 'LISTING_VERIFIED_ACCOUNT_REQUIRED'});
      }

      const bytes = await readImageBody(request);
      const image = validatedImage(bytes, requestHeader(request, 'content-type'));
      const ownerScope = createHmac('sha256', sessionSecret)
        .update(String(session.user.id))
        .digest('hex')
        .slice(0, 32);
      const contentDigest = createHash('sha256').update(bytes).digest('hex');
      const pathname = `listing-media/${ownerScope}/${contentDigest}.${image.extension}`;
      const blob = await putBlob(pathname, bytes, {
        access: 'public',
        contentType: image.contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      const url = publicBlobUrl(blob?.url, pathname);
      return response.status(201).json({
        url,
        pathname,
        contentType: image.contentType,
        sizeBytes: bytes.length,
      });
    } catch (error) {
      if (error?.code === 'LISTING_IMAGE_TOO_LARGE') {
        return response.status(413).json({error: 'LISTING_IMAGE_TOO_LARGE'});
      }
      if (error?.code === 'LISTING_IMAGE_INVALID') {
        return response.status(400).json({error: 'LISTING_IMAGE_INVALID'});
      }
      if (Number(error?.status) === 429 || Number(error?.status) === 402) {
        response.setHeader('Retry-After', '300');
      }
      return response.status(503).json({error: 'LISTING_MEDIA_UNAVAILABLE'});
    }
  };
}
