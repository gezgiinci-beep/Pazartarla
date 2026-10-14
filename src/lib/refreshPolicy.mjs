export const AUTOMATIC_REFRESH_INTERVAL_MS = 5 * 60_000;

export function automaticRefreshDue(lastStartedAt, now = Date.now(), intervalMs = AUTOMATIC_REFRESH_INTERVAL_MS) {
  return !Number.isFinite(lastStartedAt) || lastStartedAt <= 0 ||
    !Number.isFinite(now) || now - lastStartedAt >= intervalMs;
}
