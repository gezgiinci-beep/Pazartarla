import { createTursoConnection } from './turso.js';
import { getAuthSession, getSessionSecret } from './tursoAuth.js';
import { readTursoSubmissionData } from './tursoSubmissionData.js';

export function createSubmissionDataHandler({
  connect = createTursoConnection,
  authEnabled = () => process.env.PAZARTARLA_AUTH_BACKEND === 'turso',
  secretProvider = getSessionSecret,
  getSession = getAuthSession,
  readData = readTursoSubmissionData,
  now = () => new Date(),
} = {}) {
  return async function submissionDataHandler(request, response) {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Vary', 'Cookie');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    const enabled = typeof authEnabled === 'function' ? authEnabled() : authEnabled;
    if (!enabled) return response.status(503).json({ error: 'auth_unavailable' });

    try {
      const secret = secretProvider();
      if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
        return response.status(503).json({ error: 'auth_unavailable' });
      }
      const database = connect();
      const session = await getSession(database, request, secret, now());
      if (!session?.user?.id) return response.status(401).json({ error: 'login_required' });
      const data = await readData(database, {
        userId: session.user.id,
        isAdmin: session.is_admin === true,
        emailVerified: Boolean(session.user.email_confirmed_at),
        now: now(),
      });
      return response.status(200).json(data);
    } catch {
      return response.status(503).json({ error: 'submissions_unavailable' });
    }
  };
}
