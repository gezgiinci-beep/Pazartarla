const PUBLIC_ADVERTISEMENTS_SQL = `
  SELECT id, title, target_url, media_path, media_type, is_active, revision, created_at
  FROM advertisements
  WHERE is_active = 1
  ORDER BY created_at DESC, id DESC
  LIMIT 100
`;

export async function readPublicAdvertisementsFromTurso(database) {
  const rows = await database.all(PUBLIC_ADVERTISEMENTS_SQL);
  if (!Array.isArray(rows)) throw new Error('INVALID_ADVERTISEMENT_QUERY_RESULT');

  return rows.map(row => ({
    id: String(row.id),
    title: String(row.title),
    target_url: row.target_url == null ? null : String(row.target_url),
    media_path: String(row.media_path),
    media_type: row.media_type,
    is_active: row.is_active === true || row.is_active === 1,
    revision: Number(row.revision),
    created_at: String(row.created_at),
  }));
}

export const publicAdvertisementsSqlForTests = PUBLIC_ADVERTISEMENTS_SQL;
