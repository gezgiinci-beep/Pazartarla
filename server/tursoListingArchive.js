const PAGE_SIZE = 50;

function validListingId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function archivedListing(row) {
  let galleryPaths = [];
  if (typeof row.gallery_paths === 'string' && row.gallery_paths) {
    try {
      const parsed = JSON.parse(row.gallery_paths);
      if (Array.isArray(parsed)) galleryPaths = parsed;
    } catch {
      throw new Error('ARCHIVE_DATA_INVALID');
    }
  } else if (Array.isArray(row.gallery_paths)) {
    galleryPaths = row.gallery_paths;
  }
  return {
    ...row,
    price: Number(row.price),
    is_featured: row.is_featured == null ? null : Boolean(row.is_featured),
    gallery_paths: galleryPaths,
  };
}

export async function readTursoListingArchive(database, { offset = 0, now = new Date() } = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 5_000_000) {
    const error = new Error('ARCHIVE_INVALID');
    error.status = 400;
    throw error;
  }
  const rows = await database.all(
    `SELECT id, title, created_at, expires_at, status
       FROM listings
      WHERE expires_at IS NOT NULL AND expires_at <= ?
      ORDER BY expires_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    now.toISOString(),
    PAGE_SIZE + 1,
    offset,
  );
  return { items: rows.slice(0, PAGE_SIZE), has_more: rows.length > PAGE_SIZE };
}

export async function readTursoArchivedListing(database, idValue, now = new Date()) {
  const id = validListingId(idValue);
  if (!id) {
    const error = new Error('ARCHIVE_INVALID');
    error.status = 400;
    throw error;
  }
  const row = await database.get(
    `SELECT * FROM listings
      WHERE id = ? AND expires_at IS NOT NULL AND expires_at <= ?
      LIMIT 1`,
    id,
    now.toISOString(),
  );
  if (!row) return null;
  return archivedListing(row);
}

export function createTursoListingArchiveHandler({
  connect,
  authenticate = authenticateTursoAdmin,
  readArchive = readTursoListingArchive,
  readListing = readTursoArchivedListing,
  now = () => new Date(),
} = {}) {
  return async function tursoListingArchiveHandler(request, response) {
    setPrivateJsonHeaders(response);
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      return response.status(405).json({ error: 'method_not_allowed' });
    }
    try {
      const access = await authenticate(request, { connect, now });
      if (access.status) return response.status(access.status).json({ error: access.error });
      if (request.query?.id != null) {
        const listing = await readListing(access.database, request.query.id, access.currentTime);
        if (!listing) return response.status(404).json({ error: 'ARCHIVE_NOT_FOUND' });
        return response.status(200).json({ listing });
      }
      const offset = Number(request.query?.offset ?? 0);
      const page = await readArchive(access.database, { offset, now: access.currentTime });
      return response.status(200).json(page);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 503;
      return response.status(status).json({
        error: error?.message === 'ARCHIVE_INVALID' ? 'ARCHIVE_INVALID' : 'ARCHIVE_UNAVAILABLE',
      });
    }
  };
}
