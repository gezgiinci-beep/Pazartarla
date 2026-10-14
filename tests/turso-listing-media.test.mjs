import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createTursoListingMediaUploadHandler} from '../server/tursoListingMedia.js';
import {persistTursoListingImages} from '../src/lib/listingMedia.mjs';
import mediaApi, {config as mediaApiConfig} from '../api/listing-media.js';

const USER_SESSION = {
  user: {id: 'member-photo-test', email_confirmed_at: '2026-01-01T00:00:00.000Z'},
};
const PNG_BYTES = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;
const PUBLIC_BLOB_URL = 'https://store-test.public.blob.vercel-storage.com/listing-media/test.png';

function request(body = PNG_BYTES, contentType = 'image/png') {
  const stream = Readable.from([body]);
  stream.method = 'POST';
  stream.headers = {
    origin: 'https://pazartarla.example',
    host: 'pazartarla.example',
    'x-forwarded-proto': 'https',
    'content-type': contentType,
    'content-length': String(body.length),
  };
  return stream;
}

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function handler(overrides = {}) {
  const calls = [];
  const options = {
    connect: () => ({}),
    authEnabled: true,
    mutationsEnabled: true,
    mediaEnabled: true,
    storageConfigured: true,
    secretProvider: () => 's'.repeat(48),
    getSession: async () => USER_SESSION,
    putBlob: async (pathname, bytes, settings) => {
      calls.push({pathname, bytes: Buffer.from(bytes), settings});
      return {url: `https://store-test.public.blob.vercel-storage.com/${pathname}`};
    },
    ...overrides,
  };
  return {run: createTursoListingMediaUploadHandler(options), calls};
}

test('Vercel media API leaves raw bytes unparsed for the strict 2 MB validation', () => {
  assert.equal(mediaApiConfig.api.bodyParser, false);
  assert.equal(typeof mediaApi, 'function');
});

test('a verified Turso member can upload a validated public listing image to Vercel Blob', async () => {
  const {run, calls} = handler();
  const res = response();
  await run(request(), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.contentType, 'image/png');
  assert.equal(res.body.sizeBytes, PNG_BYTES.length);
  assert.equal(res.body.url, `https://store-test.public.blob.vercel-storage.com/${res.body.pathname}`);
  assert.match(res.body.pathname, /^listing-media\/[a-f0-9]{32}\/[a-f0-9]{64}\.png$/);
  assert.equal(res.body.pathname.includes(USER_SESSION.user.id), false);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].bytes, PNG_BYTES);
  assert.equal(calls[0].settings.access, 'public');
  assert.equal(calls[0].settings.contentType, 'image/png');
  assert.equal(calls[0].settings.allowOverwrite, true);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('media upload stays disabled unless the Turso and Blob feature flags are enabled', async () => {
  let connected = false;
  let uploaded = false;
  const {run} = handler({
    connect: () => { connected = true; return {}; },
    mediaEnabled: false,
    putBlob: async () => { uploaded = true; },
  });
  const res = response();
  await run(request(), res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'LISTING_MEDIA_STORAGE_REQUIRED');
  assert.equal(connected, false);
  assert.equal(uploaded, false);
});

test('unverified sessions and cross-origin uploads never reach Blob', async () => {
  let uploaded = false;
  const {run} = handler({
    getSession: async () => null,
    putBlob: async () => { uploaded = true; },
  });
  const unauthorized = response();
  await run(request(), unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.body.error, 'LISTING_VERIFIED_ACCOUNT_REQUIRED');

  const crossOriginRequest = request();
  crossOriginRequest.headers.origin = 'https://attacker.example';
  const crossOrigin = response();
  await handler({putBlob: async () => { uploaded = true; }}).run(crossOriginRequest, crossOrigin);
  assert.equal(crossOrigin.statusCode, 403);
  assert.equal(uploaded, false);
});

test('invalid image signatures, unsupported MIME types, and oversized files are rejected', async () => {
  let uploads = 0;
  const uploadHandler = handler({putBlob: async () => { uploads += 1; }});
  const wrongMime = response();
  await uploadHandler.run(request(PNG_BYTES, 'image/jpeg'), wrongMime);
  assert.equal(wrongMime.statusCode, 400);
  assert.equal(wrongMime.body.error, 'LISTING_IMAGE_INVALID');

  const wrongSignature = response();
  await uploadHandler.run(request(Buffer.from('not an image'), 'image/png'), wrongSignature);
  assert.equal(wrongSignature.statusCode, 400);

  const large = request(Buffer.alloc((2 * 1024 * 1024) + 1), 'image/png');
  const tooLarge = response();
  await uploadHandler.run(large, tooLarge);
  assert.equal(tooLarge.statusCode, 413);
  assert.equal(tooLarge.body.error, 'LISTING_IMAGE_TOO_LARGE');
  assert.equal(uploads, 0);
});

test('Blob quota and provider failures become a short, private retry response', async () => {
  const {run} = handler({
    putBlob: async () => {
      const error = new Error('private provider response');
      error.status = 402;
      throw error;
    },
  });
  const res = response();
  await run(request(), res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'LISTING_MEDIA_UNAVAILABLE');
  assert.equal(res.headers['Retry-After'], '300');
  assert.equal(JSON.stringify(res.body).includes('private provider response'), false);
});

test('Turso listing photo persistence uploads data images once and keeps HTTPS references intact', async () => {
  const userId = 'client-media-' + Date.now();
  let calls = 0;
  const fetcher = async (_url, options) => {
    calls += 1;
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers['Content-Type'], 'image/png');
    assert.equal((await options.body.arrayBuffer()).byteLength, PNG_BYTES.length);
    return {
      ok: true,
      status: 201,
      headers: {get: () => null},
      json: async () => ({url: PUBLIC_BLOB_URL}),
    };
  };
  const externalImage = 'https://images.example.test/old-supabase-photo.jpg';
  const result = await persistTursoListingImages([PNG_DATA_URL, externalImage], {userId, fetcher});
  assert.deepEqual(result.images, [PUBLIC_BLOB_URL, externalImage]);
  assert.deepEqual(result.gallery_paths, result.images);
  assert.equal(result.image, PUBLIC_BLOB_URL);

  const repeated = await persistTursoListingImages([PNG_DATA_URL], {userId, fetcher});
  assert.deepEqual(repeated.images, [PUBLIC_BLOB_URL]);
  assert.equal(calls, 1);
});

test('Turso photo retries back off locally instead of repeating a 402 or 429 request', async () => {
  const userId = 'backoff-media-' + Date.now();
  let clock = 10_000;
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        ok: false,
        status: 503,
        headers: {get: () => '3'},
        json: async () => ({error: 'LISTING_MEDIA_UNAVAILABLE'}),
      };
    }
    return {
      ok: true,
      status: 201,
      headers: {get: () => null},
      json: async () => ({url: PUBLIC_BLOB_URL}),
    };
  };

  await assert.rejects(
    persistTursoListingImages([PNG_DATA_URL], {userId, fetcher, now: () => clock}),
    /LISTING_MEDIA_UNAVAILABLE/,
  );
  await assert.rejects(
    persistTursoListingImages([PNG_DATA_URL], {userId, fetcher, now: () => clock}),
    /LISTING_MEDIA_RETRY_LATER/,
  );
  assert.equal(calls, 1);

  clock += 3_001;
  const result = await persistTursoListingImages([PNG_DATA_URL], {userId, fetcher, now: () => clock});
  assert.deepEqual(result.images, [PUBLIC_BLOB_URL]);
  assert.equal(calls, 2);
});
