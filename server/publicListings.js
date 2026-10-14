const PUBLIC_LISTING_COLUMNS = [
  'id',
  'title',
  'price',
  'category',
  '"subCategory"',
  'mode',
  'location',
  'description',
  'seller',
  'phone',
  'image',
  'gallery_paths',
  'is_featured',
  'status',
  'created_at',
  'expires_at',
  'submitted_by',
];

const PUBLIC_LISTINGS_SQL = `
  SELECT ${PUBLIC_LISTING_COLUMNS.join(', ')}
  FROM listings
  WHERE status = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 1000
`;

function decodeGalleryPaths(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeListing(row) {
  const price = Number(row.price);
  return {
    ...row,
    price: Number.isFinite(price) ? price : row.price,
    gallery_paths: decodeGalleryPaths(row.gallery_paths),
    is_featured: row.is_featured == null ? null : Boolean(row.is_featured),
  };
}

export async function readPublicListingsFromTurso(database) {
  const rows = await database.all(PUBLIC_LISTINGS_SQL, 'approved');
  if (!Array.isArray(rows)) throw new Error('INVALID_LISTING_QUERY_RESULT');
  return rows.map(row => normalizeListing(row));
}

export const publicListingsSqlForTests = PUBLIC_LISTINGS_SQL;
