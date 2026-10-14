import {createHash} from 'node:crypto';
import {imageData, legacyListingMetadata} from '../src/lib/listingMedia.mjs';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 250;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_SEO_TAGS_BYTES = 4096;
const LEGACY_IMAGE_ROWS_SQL = `
  SELECT id, image, seotags, gallery_paths, is_featured
  FROM listings
  WHERE image LIKE 'data:image/%'
     OR seotags LIKE '%__PAZARTARLA_META_V1__:%'
     OR gallery_paths LIKE '%data:image/%'
  ORDER BY id
`;

function parseGalleryPaths(value, legacyImages) {
  if (value == null || value === '') return [...legacyImages];
  const parsed = Array.isArray(value) ? value : JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string' || !item.trim())) {
    throw new Error('INLINE_MEDIA_GALLERY_INVALID');
  }
  return parsed;
}

function safeSeoTags(value) {
  return typeof value === 'string' &&
    Buffer.byteLength(value, 'utf8') <= MAX_SEO_TAGS_BYTES
    ? value || null
    : null;
}

function checkedBlobUrl(value, pathname) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('INLINE_MEDIA_BLOB_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !url.hostname.endsWith('.public.blob.vercel-storage.com') ||
      url.pathname.replace(/^\/+/, '') !== pathname) {
    throw new Error('INLINE_MEDIA_BLOB_URL_INVALID');
  }
  return url.href;
}

export async function migrateInlineListingMedia({database, putBlob}) {
  if (!database || typeof database.all !== 'function' ||
      typeof database.run !== 'function' || typeof putBlob !== 'function') {
    throw new Error('INLINE_MEDIA_MIGRATION_DEPENDENCY_MISSING');
  }

  const rows = await database.all(LEGACY_IMAGE_ROWS_SQL);
  if (!Array.isArray(rows)) throw new Error('INLINE_MEDIA_MIGRATION_INVALID_RESULT');
  if (rows.length > MAX_ROWS) throw new Error('INLINE_MEDIA_MIGRATION_ROW_LIMIT');

  const plans = rows.map(row => {
    const legacy = legacyListingMetadata(row);
    const gallery = parseGalleryPaths(row.gallery_paths, legacy.images);
    const refs = [...new Set([row.image, ...gallery].filter(
      value => typeof value === 'string' && value.startsWith('data:image/'),
    ))];
    return {row, legacy, gallery, refs};
  });

  const decodedByRow = new Map();
  let plannedBytes = 0;
  for (const plan of plans) {
    const decoded = new Map();
    for (const ref of plan.refs) {
      const image = imageData(ref, MAX_IMAGE_BYTES);
      plannedBytes += image.bytes.length;
      if (plannedBytes > MAX_TOTAL_BYTES) throw new Error('INLINE_MEDIA_MIGRATION_BYTE_LIMIT');
      decoded.set(ref, image);
    }
    decodedByRow.set(plan.row, decoded);
  }

  let imagesUploaded = 0;
  let bytesUploaded = 0;
  let rowsUpdated = 0;
  for (const plan of plans) {
    const {row, legacy} = plan;
    const decoded = decodedByRow.get(row);
    const urlByRef = new Map();

    for (const ref of plan.refs) {
      const image = decoded.get(ref);
      const digest = createHash('sha256').update(image.bytes).digest('hex');
      const pathname = `listing-media/migrated/${row.id}/${digest}.${image.extension}`;
      const blob = await putBlob(pathname, Buffer.from(image.bytes), {
        access: 'public',
        contentType: image.contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      urlByRef.set(ref, checkedBlobUrl(blob?.url, pathname));
      imagesUploaded += 1;
      bytesUploaded += image.bytes.length;
    }

    const migrateRef = value => urlByRef.get(value) ?? value ?? null;
    const image = migrateRef(row.image) ?? migrateRef(plan.gallery[0]);
    const gallery = plan.gallery.map(migrateRef);
    const cleanSeo = safeSeoTags(legacy.seoTags);
    const seotags = legacy.hasSuffix ||
      (typeof row.seotags === 'string' && Buffer.byteLength(row.seotags, 'utf8') > MAX_SEO_TAGS_BYTES)
      ? cleanSeo
      : row.seotags ?? null;
    const isFeatured = row.is_featured == null && legacy.hasSuffix
      ? Number(legacy.isFeatured)
      : row.is_featured ?? null;
    const galleryPaths = plan.gallery.length &&
      (row.gallery_paths == null || plan.refs.some(ref => decoded.has(ref)) || legacy.hasSuffix)
      ? JSON.stringify(gallery)
      : row.gallery_paths ?? null;

    const changed = image !== (row.image ?? null) ||
      galleryPaths !== (row.gallery_paths ?? null) ||
      seotags !== (row.seotags ?? null) ||
      isFeatured !== (row.is_featured ?? null);
    if (!changed) continue;

    const result = await database.run(
      `UPDATE listings
       SET image = ?, gallery_paths = ?, seotags = ?, is_featured = ?
       WHERE id = ? AND image IS ? AND gallery_paths IS ? AND seotags IS ? AND is_featured IS ?`,
      image,
      galleryPaths,
      seotags,
      isFeatured,
      row.id,
      row.image ?? null,
      row.gallery_paths ?? null,
      row.seotags ?? null,
      row.is_featured ?? null,
    );
    if (Number(result?.rowsAffected ?? result?.changes ?? 0) !== 1) {
      throw new Error('INLINE_MEDIA_MIGRATION_ROW_CHANGED');
    }
    rowsUpdated += 1;
  }

  return {rowsScanned: rows.length, rowsUpdated, imagesUploaded, bytesUploaded};
}

export const inlineListingMediaMigrationSqlForTests = LEGACY_IMAGE_ROWS_SQL;
