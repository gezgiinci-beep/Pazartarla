const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

function readHeader(request, name) {
  const headers = request.headers;
  return typeof headers?.get === 'function'
    ? headers.get(name)
    : headers?.[name.toLowerCase()] ?? headers?.[name];
}

function queryEntries(query) {
  const entries = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === '__route' || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      entries.push([key, String(item)]);
    }
  }
  return entries;
}

function cleanQuery(query) {
  const result = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key === '__route' || value == null) continue;
    result[key] = Array.isArray(value) ? value.map(String) : String(value);
  }
  return result;
}

function routeName(request) {
  const queryRoute = request.query?.__route;
  const raw = typeof queryRoute === 'string'
    ? queryRoute
    : new URL(request.url || '/', 'https://pazartarla.invalid').searchParams.get('__route');
  if (!raw || typeof raw !== 'string') return '';
  const normalized = raw.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.split('/').some(part =>
    !part || part === '.' || part === '..' || !/^[a-z0-9-]+$/i.test(part))) {
    return '';
  }
  return normalized;
}

async function readBody(request, limit) {
  const declaredLength = Number(readHeader(request, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    return { error: 'too_large' };
  }
  if (Buffer.isBuffer(request.body) || request.body instanceof Uint8Array) {
    const body = Buffer.from(request.body);
    return body.length > limit ? { error: 'too_large' } : { body };
  }
  if (typeof request.body === 'string') {
    const body = Buffer.from(request.body);
    return body.length > limit ? { error: 'too_large' } : { body };
  }
  if (request.body && typeof request.body === 'object') return { parsed: request.body };
  if (typeof request[Symbol.asyncIterator] !== 'function') return { body: Buffer.alloc(0) };

  const chunks = [];
  let length = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    length += chunk.length;
    if (length > limit) return { error: 'too_large' };
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks, length) };
}

async function parseJsonRequest(request, response) {
  const contentType = String(readHeader(request, 'content-type') || '')
    .split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json' && !contentType.endsWith('+json') &&
      contentType !== 'application/x-www-form-urlencoded') {
    return true;
  }

  const result = await readBody(request, MAX_JSON_BODY_BYTES);
  if (result.error === 'too_large') {
    response.setHeader?.('Cache-Control', 'no-store');
    response.status(413).json({ error: 'request_too_large' });
    return false;
  }
  if (Object.hasOwn(result, 'parsed')) {
    request.body = result.parsed;
    return true;
  }
  const text = result.body.toString('utf8');
  if (!text.trim()) {
    request.body = null;
    return true;
  }
  try {
    request.body = contentType === 'application/x-www-form-urlencoded'
      ? Object.fromEntries(new URLSearchParams(text))
      : JSON.parse(text);
    return true;
  } catch {
    response.setHeader?.('Cache-Control', 'no-store');
    response.status(400).json({ error: 'invalid_request_body' });
    return false;
  }
}

export function createVercelApiRouter(handlers) {
  return async function vercelApiRouter(request, response) {
    const route = routeName(request);
    const handlerKey = route.startsWith('auth/') ? 'auth-router' : route;
    const handler = handlers[handlerKey];
    if (typeof handler !== 'function') {
      response.setHeader?.('Cache-Control', 'no-store');
      return response.status(404).json({ error: 'not_found' });
    }

    const query = cleanQuery(request.query);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
    }
    request.query = query;
    request.url = `/api/${route}${search.size ? `?${search}` : ''}`;

    if (!await parseJsonRequest(request, response)) return;
    return handler(request, response);
  };
}

