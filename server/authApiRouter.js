export function createAuthApiRouter(handlers) {
  return async function authApiRouter(request, response) {
    let pathname;
    let actionFromUrl;
    try {
      const requestUrl = new URL(request.url || '/', 'https://pazartarla.invalid');
      pathname = requestUrl.pathname;
      actionFromUrl = requestUrl.searchParams.get('action');
    } catch {
      pathname = '';
      actionFromUrl = null;
    }

    const routedAction = pathname === '/api/auth-router'
      ? (typeof request.query?.action === 'string' ? request.query.action : actionFromUrl)
      : null;
    if (!pathname.startsWith('/api/auth/') && routedAction === null) {
      response.setHeader?.('Cache-Control', 'no-store');
      return response.status(404).json({ error: 'not_found' });
    }

    const segments = pathname.startsWith('/api/auth/')
      ? pathname.slice('/api/auth/'.length).split('/').filter(Boolean)
      : [];
    const action = routedAction ?? (segments.length === 1 ? segments[0] : '');
    const handler = handlers[action];
    if (typeof handler !== 'function') {
      response.setHeader?.('Cache-Control', 'no-store');
      return response.status(404).json({ error: 'not_found' });
    }

    return handler(request, response);
  };
}
