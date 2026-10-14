const SETTINGS_COLUMNS = 'id, announcement, categories, featured_offer, revision';
const SETTINGS_PATCH_KEYS = new Set(['announcement', 'categories', 'featured_offer']);

function parseStoredJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('INVALID_SITE_SETTINGS_JSON');
  }
}

export function validTursoCategories(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length > 0 && entries.length <= 100 && entries.every(([name, subs]) =>
    name.trim() === name && name.length > 0 && name.length <= 100 &&
    !['__proto__', 'constructor', 'prototype'].includes(name) &&
    Array.isArray(subs) && subs.length > 0 && subs.length <= 200 &&
    subs.every(sub => typeof sub === 'string' && sub.trim() === sub && sub.length > 0 && sub.length <= 100) &&
    new Set(subs).size === subs.length
  );
}

export function validTursoFeaturedOffer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const price = value.monthly_price_try;
  return keys.length === 2 && keys.includes('monthly_price_try') && keys.includes('description') &&
    typeof price === 'number' && Number.isFinite(price) && price > 0 && price <= 1_000_000 &&
    Number(price.toFixed(2)) === price &&
    typeof value.description === 'string' && value.description.length <= 400;
}

export function normalizeTursoSiteSettings(row) {
  if (!row || row.id !== 'public' || typeof row.announcement !== 'string' ||
      row.announcement.length > 1000 || !Number.isSafeInteger(Number(row.revision)) ||
      Number(row.revision) < 1) {
    throw new Error('INVALID_SITE_SETTINGS_ROW');
  }
  const categories = parseStoredJson(row.categories);
  const featuredOffer = parseStoredJson(row.featured_offer);
  if (!validTursoCategories(categories) || !validTursoFeaturedOffer(featuredOffer)) {
    throw new Error('INVALID_SITE_SETTINGS_ROW');
  }
  return {
    id: 'public',
    announcement: row.announcement,
    categories,
    featured_offer: featuredOffer,
    revision: Number(row.revision),
  };
}

export async function readTursoSiteSettings(database) {
  const row = await database.get(
    `SELECT ${SETTINGS_COLUMNS} FROM site_settings WHERE id = ? LIMIT 1`,
    'public',
  );
  return row ? normalizeTursoSiteSettings(row) : null;
}

export function validateTursoSettingsPatch(revision, patch) {
  if (!Number.isSafeInteger(revision) || revision < 1 ||
      !patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return false;
  }
  const keys = Object.keys(patch);
  if (keys.length !== 1 || !SETTINGS_PATCH_KEYS.has(keys[0])) return false;
  if ('announcement' in patch) {
    return typeof patch.announcement === 'string' && patch.announcement.length <= 1000;
  }
  if ('categories' in patch) return validTursoCategories(patch.categories);
  return validTursoFeaturedOffer(patch.featured_offer);
}

export async function updateTursoSiteSettings(database, revision, patch) {
  if (!validateTursoSettingsPatch(revision, patch)) {
    const error = new Error('INVALID_SITE_SETTINGS_PATCH');
    error.code = 'INVALID_SITE_SETTINGS_PATCH';
    throw error;
  }

  const [field, value] = Object.entries(patch)[0];
  const encoded = field === 'categories' || field === 'featured_offer'
    ? JSON.stringify(value)
    : value;
  const row = await database.get(
    `UPDATE site_settings
        SET ${field} = ?,
            revision = revision + 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND revision = ?
      RETURNING ${SETTINGS_COLUMNS}`,
    encoded,
    'public',
    revision,
  );
  if (row) return normalizeTursoSiteSettings(row);

  const exists = await database.get(
    'SELECT 1 AS present FROM site_settings WHERE id = ? LIMIT 1',
    'public',
  );
  if (!exists) {
    const error = new Error('SITE_SETTINGS_NOT_FOUND');
    error.code = 'SITE_SETTINGS_NOT_FOUND';
    throw error;
  }
  const error = new Error('SITE_SETTINGS_REVISION_CONFLICT');
  error.code = 'SITE_SETTINGS_REVISION_CONFLICT';
  throw error;
}
