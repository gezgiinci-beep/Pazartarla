import { randomUUID } from 'node:crypto';
import { createTursoConnection } from './turso.js';
import { isSameOrigin, parseJsonBody } from './tursoAuth.js';
import { authenticateTursoAdmin, setPrivateJsonHeaders } from './tursoAdminAccess.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp|mp4|webm)$/i;

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}

function normalizeFields(input, { creating = false } = {}) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const target = typeof input?.target_url === 'string' ? input.target_url.trim() : '';
  const mediaPath = typeof input?.media_path === 'string' ? input.media_path.trim() : '';
  const mediaType = input?.media_type;
  let targetUrl = null;
  if (!title || title.length > 120 || !mediaPath || !['image', 'video'].includes(mediaType)) {
    fail('AD_INVALID');
  }
  if (target) {
    let parsed;
    try { parsed = new URL(target); } catch { fail('AD_INVALID'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
        target.length > 2048) fail('AD_INVALID');
    targetUrl = parsed.href;
  }
  let objectPath = mediaPath;
  if (mediaPath.startsWith('https://')) {
    let url;
    try { url = new URL(mediaPath); } catch { fail('AD_MEDIA_INVALID'); }
    if (url.protocol !== 'https:' || url.username || url.password ||
        !url.hostname.endsWith('.public.blob.vercel-storage.com')) fail('AD_MEDIA_INVALID');
    objectPath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  }
  const pathMatch = PATH.exec(objectPath);
  if (!pathMatch || pathMatch[1].toLowerCase() !== String(input.id || '').toLowerCase()) {
    fail('AD_MEDIA_INVALID');
  }
  const extensionType = ['mp4', 'webm'].includes(pathMatch[3].toLowerCase()) ? 'video' : 'image';
  if (mediaType !== extensionType) fail('AD_MEDIA_INVALID');
  return {
    title,
    target_url: targetUrl,
    media_path: mediaPath,
    media_type: mediaType,
    is_active: creating ? 0 : input.is_active === true ? 1 : input.is_active === false ? 0 : null,
  };
}

export async function readTursoAdvertisements(database) {
  const rows = await database.all(
    `SELECT id, title, target_url, media_path, media_type, is_active, revision, created_at
       FROM advertisements ORDER BY created_at DESC, id DESC LIMIT 500`,
  );
  return rows.map(row => ({
    ...row,
    is_active: Number(row.is_active) === 1,
    revision: Number(row.revision),
  }));
}

export async function readTursoAdvertisement(database, id) {
  if (!UUID.test(String(id))) fail('AD_INVALID');
  const row = await database.get(
    `SELECT id, title, target_url, media_path, media_type, is_active, revision, created_at
       FROM advertisements WHERE id = ? LIMIT 1`,
    id,
  );
  return row ? { ...row, is_active: Number(row.is_active) === 1, revision: Number(row.revision) } : null;
}

export async function mutateTursoAdvertisement(database, session, method, payload, now = new Date()) {
  const id = payload?.id;
  if (!UUID.test(String(id))) fail('AD_INVALID');
  if (typeof database?.transactionAsync !== 'function') throw new Error('AD_TRANSACTION_REQUIRED');
  const transaction = database.transactionAsync(async tx => {
    if (method === 'POST') {
      const fields = normalizeFields({ ...payload, id }, { creating: true });
      await tx.run(
        `INSERT INTO advertisements
           (id, title, target_url, media_path, media_type, is_active, revision,
            created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`,
        id,
        fields.title,
        fields.target_url,
        fields.media_path,
        fields.media_type,
        session.user.id,
        now.toISOString(),
        now.toISOString(),
      );
    } else {
      if (!Number.isSafeInteger(payload?.revision) || payload.revision < 1) fail('AD_INVALID');
      const current = await tx.get('SELECT * FROM advertisements WHERE id = ? LIMIT 1', id);
      if (!current || Number(current.revision) !== payload.revision) fail('AD_CONFLICT', 409);
      if (method === 'PATCH') {
        const fields = normalizeFields({
          id,
          title: payload.title ?? current.title,
          target_url: payload.target_url === undefined ? current.target_url : payload.target_url,
          media_path: payload.media_path ?? current.media_path,
          media_type: payload.media_type ?? current.media_type,
          is_active: payload.is_active === undefined
            ? Number(current.is_active) === 1
            : payload.is_active,
        });
        await tx.run(
          `UPDATE advertisements SET title = ?, target_url = ?, media_path = ?,
             media_type = ?, is_active = ?, revision = revision + 1, updated_at = ?
           WHERE id = ? AND revision = ?`,
          fields.title,
          fields.target_url,
          fields.media_path,
          fields.media_type,
          fields.is_active,
          now.toISOString(),
          id,
          payload.revision,
        );
      } else if (method === 'DELETE') {
        await tx.run('DELETE FROM advertisements WHERE id = ? AND revision = ?', id, payload.revision);
      } else {
        fail('AD_INVALID', 405);
      }
    }
    if (method === 'DELETE') return { id, deleted: true };
    const saved = await tx.get(
      `SELECT id, title, target_url, media_path, media_type, is_active, revision, created_at
         FROM advertisements WHERE id = ? LIMIT 1`,
      id,
    );
    if (!saved || (method === 'POST' && Number(saved.is_active) !== 0)) {
      throw new Error('AD_READBACK_FAILED');
    }
    return { ...saved, is_active: Number(saved.is_active) === 1, revision: Number(saved.revision) };
  });
  if (typeof transaction?.immediate !== 'function') throw new Error('AD_TRANSACTION_REQUIRED');
  return transaction.immediate();
}

export function createTursoAdvertisementsHandler({
  connect = createTursoConnection,
  authenticate = authenticateTursoAdmin,
  readAll = readTursoAdvertisements,
  readOne = readTursoAdvertisement,
  mutate = mutateTursoAdvertisement,
  now = () => new Date(),
} = {}) {
  return async function tursoAdvertisementsHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST, PATCH, DELETE');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    if (request.method !== 'GET' && !isSameOrigin(request)) {
      return response.status(403).json({ error: 'origin_not_allowed' });
    }
    try {
      const access = await authenticate(request, { connect, now });
      if (access.status) return response.status(access.status).json({ error: access.error });
      if (request.method === 'GET') {
        const id = request.query?.id;
        if (id) {
          const advertisement = await readOne(access.database, id);
          return response.status(advertisement ? 200 : 404).json({ advertisement });
        }
        return response.status(200).json({ advertisements: await readAll(access.database) });
      }
      const payload = parseJsonBody(request);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return response.status(400).json({ error: 'AD_INVALID' });
      }
      const advertisement = await mutate(
        access.database,
        access.session,
        request.method,
        payload,
        access.currentTime || now(),
      );
      return response.status(200).json({ advertisement });
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      const code = /^AD_[A-Z_]+$/.test(String(error?.code || '')) ? error.code : 'AD_UNAVAILABLE';
      return response.status(status).json({ error: code });
    }
  };
}

