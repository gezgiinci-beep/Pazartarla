import {put} from '@vercel/blob';
import {createTursoConnection} from '../server/turso.js';
import {migrateInlineListingMedia} from '../server/inlineListingMediaMigration.js';

if (process.env.VERCEL_ENV !== 'production' ||
    process.env.PAZARTARLA_INLINE_IMAGE_MIGRATION !== 'true') {
  console.log('Legacy inline listing-media migration skipped.');
} else {
  try {
    if (process.env.PAZARTARLA_LISTING_MEDIA_BACKEND !== 'vercel_blob') {
      throw new Error('INLINE_MEDIA_STORAGE_NOT_ENABLED');
    }
    const result = await migrateInlineListingMedia({
      database: createTursoConnection(),
      putBlob: put,
    });
    console.log(
      `Inline listing media migrated: ${result.rowsUpdated} rows, ` +
      `${result.imagesUploaded} images, ${result.bytesUploaded} bytes.`,
    );
  } catch (error) {
    console.error(`Inline listing-media migration failed: ${error?.message || 'unknown error'}`);
    process.exitCode = 1;
  }
}
