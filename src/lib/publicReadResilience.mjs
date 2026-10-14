export function backoffDelayMs(failureCount, baseMs = 15_000, maxMs = 30 * 60_000) {
  const count = Number.isFinite(Number(failureCount)) ? Math.max(1, Math.floor(Number(failureCount))) : 1;
  return Math.min(maxMs, baseMs * 2 ** Math.min(count - 1, 30));
}

export function retryAfterDelayMs(headers, now = Date.now(), maxMs = 60 * 60_000) {
  try {
    const value = typeof headers?.get === 'function'
      ? headers.get('retry-after')
      : headers?.['retry-after'] ?? headers?.['Retry-After'];
    if (typeof value !== 'string' || !value.trim()) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(maxMs, seconds * 1000);
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.min(maxMs, Math.max(0, date - now)) : 0;
  } catch {
    return 0;
  }
}

export function readCachedValue(storage, key, ttlMs, validate = () => true, now = Date.now()) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!Number.isFinite(entry?.savedAt) || entry.savedAt > now ||
        now - entry.savedAt > ttlMs || !validate(entry.value)) return null;
    return entry.value;
  } catch {
    return null;
  }
}

export function writeCachedValue(storage, key, value, now = Date.now(), maxChars = 2_000_000) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    const serialized = JSON.stringify({ savedAt: now, value });
    if (serialized.length > maxChars) return false;
    storage?.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function readRetryAt(storage, key, now = Date.now()) {
  try {
    const retryAt = Number(storage?.getItem(key));
    return Number.isSafeInteger(retryAt) && retryAt > now ? retryAt : 0;
  } catch {
    return 0;
  }
}

export function writeRetryAt(storage, key, retryAt) {
  try {
    storage?.setItem(key, String(retryAt));
  } catch {
    // Browser storage is optional; in-memory backoff still protects this page.
  }
}
