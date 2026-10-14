import { createTursoConnection } from './turso.js';
import {
  createAuthActionEmail,
  getAuthEmailConfiguration,
} from './authEmail.js';
import {
  AuthFlowError,
  createTursoSignup,
  resendTursoVerification,
  requestTursoPasswordReset,
  resetTursoPassword,
  verifyTursoEmail,
} from './tursoAuthFlows.js';
import {
  getSessionSecret,
  isSameOrigin,
  parseJsonBody,
} from './tursoAuth.js';

const EMAIL_ACTIONS = new Set(['signup', 'resend', 'request-reset']);

function setHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}

function send(response, status, body) {
  return response.status(status).json(body);
}

function resolveSecret(secret, secretProvider) {
  const value = typeof secretProvider === 'function'
    ? secretProvider()
    : typeof secret === 'string' ? secret : getSessionSecret();
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32
    ? value
    : null;
}

function acceptedMessage(action) {
  if (action === 'signup') {
    return 'İşlem alındı. Hesabınız uygunsa e-posta adresinize doğrulama bağlantısı gönderilecektir.';
  }
  if (action === 'resend') {
    return 'İşlem alındı. Hesap doğrulama bekliyorsa e-posta adresinize yeni bir bağlantı gönderilecektir.';
  }
  return 'İşlem alındı. Bu e-posta doğrulanmış bir hesaba aitse parola yenileme bağlantısı gönderilecektir.';
}

function actionError(error) {
  if (error instanceof AuthFlowError) {
    return { status: error.status, body: { error: error.code.toLowerCase() } };
  }
  return { status: 503, body: { error: 'auth_unavailable' } };
}

export function createAuthFlowHandler(action, {
  connect = createTursoConnection,
  enabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secret,
  secretProvider = null,
  env = process.env,
  sendEmail = null,
  now = () => new Date(),
} = {}) {
  if (!['signup', 'resend', 'request-reset', 'verify-email', 'reset-password'].includes(action)) {
    throw new TypeError('Unsupported account action.');
  }
  return async function authFlowHandler(request, response) {
    setHeaders(response);
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return send(response, 405, { error: 'method_not_allowed' });
    }
    if (!isSameOrigin(request)) return send(response, 403, { error: 'origin_not_allowed' });
    if (!(typeof enabled === 'function' ? enabled() : enabled)) {
      return send(response, 503, { error: 'auth_unavailable' });
    }
    if (EMAIL_ACTIONS.has(action) && env.PAZARTARLA_AUTH_EMAIL_ENABLED !== 'true') {
      return send(response, 503, { error: 'email_actions_disabled' });
    }
    const sessionSecret = resolveSecret(secret, secretProvider);
    if (!sessionSecret) return send(response, 503, { error: 'auth_unavailable' });
    const body = parseJsonBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return send(response, 400, { error: 'invalid_request' });
    }

    let mailer = sendEmail;
    if (EMAIL_ACTIONS.has(action) && typeof mailer !== 'function') {
      const configuration = getAuthEmailConfiguration(env);
      if (!configuration) return send(response, 503, { error: 'email_not_configured' });
      try {
        mailer = createAuthActionEmail(configuration);
      } catch {
        return send(response, 503, { error: 'email_not_configured' });
      }
    }

    try {
      const database = connect();
      const options = { request, secret: sessionSecret, now: now() };
      if (action === 'signup' || action === 'resend' || action === 'request-reset') {
        let result;
        if (action === 'signup') {
          result = await createTursoSignup(database, { ...body, ...options });
        } else if (action === 'resend') {
          result = await resendTursoVerification(database, body.email, options);
        } else {
          result = await requestTursoPasswordReset(database, body.email, options);
        }
        if (result.mail && typeof mailer === 'function') {
          try {
            await mailer(result.mail);
          } catch {
            // Keep the same public response for existing and unknown accounts.
            // The message asks the user to retry if no email arrives.
          }
        }
        return send(response, 202, { ok: true, message: acceptedMessage(action) });
      }
      if (action === 'verify-email') {
        const result = await verifyTursoEmail(database, body.token, options);
        return send(response, 200, result);
      }
      const result = await resetTursoPassword(database, body.token, body.password, options);
      return send(response, 200, result);
    } catch (error) {
      const mapped = actionError(error);
      return send(response, mapped.status, mapped.body);
    }
  };
}
