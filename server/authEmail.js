const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function getAuthEmailConfiguration(env = process.env) {
  const apiKey = typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
  const from = typeof env.RESEND_FROM_EMAIL === 'string' ? env.RESEND_FROM_EMAIL.trim() : '';
  const rawBaseUrl = typeof env.PAZARTARLA_AUTH_BASE_URL === 'string'
    ? env.PAZARTARLA_AUTH_BASE_URL.trim()
    : '';
  if (!apiKey || !from || /[\r\n]/.test(from) || !rawBaseUrl) return null;
  try {
    const url = new URL(rawBaseUrl);
    const localDevelopment = env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(url.hostname) &&
      url.protocol === 'http:';
    if ((!localDevelopment && url.protocol !== 'https:') ||
        url.username || url.password || url.search || url.hash ||
        (url.pathname !== '/' && url.pathname !== '')) return null;
    return { apiKey, from, baseUrl: url.origin };
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createAuthActionEmail(configuration, fetchImpl = globalThis.fetch) {
  if (!configuration || typeof fetchImpl !== 'function') {
    throw new Error('Transactional email is not configured.');
  }
  return async function sendAuthActionEmail({ to, purpose, token }) {
    const isVerification = purpose === 'email_verification';
    const action = isVerification ? 'verify' : purpose === 'password_reset' ? 'reset' : null;
    if (!action || typeof to !== 'string' || !token) throw new Error('Invalid auth email request.');
    const link = `${configuration.baseUrl}/#auth_action=${action}&token=${encodeURIComponent(token)}`;
    const safeLink = escapeHtml(link);
    const subject = isVerification
      ? 'PazarTarla e-posta adresinizi doğrulayın'
      : 'PazarTarla parola yenileme bağlantısı';
    const instruction = isVerification
      ? 'PazarTarla hesabınızı doğrulamak için bu bağlantıyı açın.'
      : 'PazarTarla parolanızı yenilemek için bu bağlantıyı açın.';
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: configuration.from,
        to,
        subject,
        text: `${instruction}\n\n${link}\n\nBu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.`,
        html: `<div style="font-family:Arial,sans-serif;color:#26392e"><h2>PazarTarla</h2><p>${instruction}</p><p><a href="${safeLink}">Devam etmek için tıklayın</a></p><p>Bu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.</p></div>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Transactional email delivery failed.');
  };
}
