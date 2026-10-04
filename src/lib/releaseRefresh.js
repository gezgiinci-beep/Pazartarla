export function isNewRelease(currentId, value) {
  return value && typeof value.id === 'string' &&
    /^(?:local|[a-f0-9]{7,40})-\d{17}$/.test(value.id) && value.id !== currentId;
}

/** A failed optional version check must not block startup or discard a draft. */
export function createReleaseChecker(currentId, readVersion, notify) {
  let busy = false;
  let notified = false;
  return async function check() {
    if (busy || notified) return false;
    busy = true;
    try {
      const version = await readVersion();
      if (!isNewRelease(currentId, version)) return false;
      notified = true;
      notify();
      return true;
    } catch {
      return false;
    } finally {
      busy = false;
    }
  };
}

export function startReleaseRefresh(base, buildId) {
  let banner;
  const notify = () => {
    if (banner) return;
    banner = document.createElement('aside');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.id = 'pazartarla-release-update';
    Object.assign(banner.style, {
      position: 'fixed', bottom: '20px', left: '16px', right: '16px',
      margin: '0 auto', maxWidth: '620px', zIndex: '10000', padding: '16px',
      background: '#153e2d', color: '#ffffff', borderRadius: '12px',
      boxShadow: '0 4px 20px #0003', display: 'flex', flexWrap: 'wrap',
      alignItems: 'center', gap: '12px', font: '14px/1.5 system-ui',
    });
    const text = document.createElement('span');
    text.textContent = 'Yeni sürüm hazır. Kaydedilmemiş değişikliklerinizi kaydettikten sonra yenileyin.';
    text.style.flex = '1 1 280px';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Yeni sürümü aç';
    Object.assign(button.style, {
      background: '#ffffff', color: '#153e2d', border: 'none',
      borderRadius: '8px', padding: '10px 14px', cursor: 'pointer', font: 'inherit',
    });
    button.addEventListener('click', () => window.location.reload());
    banner.append(text, button);
    document.body.append(banner);
  };
  const check = createReleaseChecker(buildId, async () => {
    const response = await fetch(base + 'version.json', {
      cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Release metadata unavailable');
    }
    return response.json();
  }, notify);
  const checkVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };
  // Never automatically reload: member/admin forms may contain unsaved work.
  window.addEventListener('focus', checkVisible);
  document.addEventListener('visibilitychange', checkVisible);
  window.addEventListener('vite:preloadError', notify);
  const interval = window.setInterval(checkVisible, 60000);
  checkVisible();
  return () => {
    window.clearInterval(interval);
    window.removeEventListener('focus', checkVisible);
    document.removeEventListener('visibilitychange', checkVisible);
    window.removeEventListener('vite:preloadError', notify);
    banner?.remove();
  };
}