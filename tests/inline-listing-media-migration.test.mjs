import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LISTING_META_MARKER} from '../src/lib/listingMedia.mjs';
import {
  inlineListingMediaMigrationSqlForTests,
  migrateInlineListingMedia,
} from '../server/inlineListingMediaMigration.js';

const tinyJpeg = 'data:image/jpeg;base64,/9j/2Q==';

test('inline image migration uploads old photos, normalizes gallery metadata, and preserves featured state', async () => {
  const metadata = encodeURIComponent(JSON.stringify({
    images: [tinyJpeg],
    isFeatured: true,
  }));
  const row = {
    id: 157,
    image: tinyJpeg,
    seotags: `legacy tags${LISTING_META_MARKER}${metadata}`,
    gallery_paths: null,
    is_featured: null,
  };
  const uploads = [];
  const updates = [];
  const database = {
    async all(sql) {
      assert.equal(sql, inlineListingMediaMigrationSqlForTests);
      return [row];
    },
    async run(sql, ...args) {
      updates.push({sql, args});
      return {changes: 1};
    },
  };

  const result = await migrateInlineListingMedia({
    database,
    async putBlob(pathname, bytes, options) {
      uploads.push({pathname, bytes: Buffer.from(bytes), options});
      return {url: `https://store.public.blob.vercel-storage.com/${pathname}`};
    },
  });

  assert.deepEqual(result, {rowsScanned: 1, rowsUpdated: 1, imagesUploaded: 1, bytesUploaded: 4});
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].pathname, 'listing-media/migrated/157/32461d5bd1773012acef0ba15636752949bd7c2ce50f9172159d9f56cf0dd9af.jpg');
  assert.equal(uploads[0].options.access, 'public');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].args.slice(0, 4), [
    `https://store.public.blob.vercel-storage.com/${uploads[0].pathname}`,
    JSON.stringify([`https://store.public.blob.vercel-storage.com/${uploads[0].pathname}`]),
    'legacy tags',
    1,
  ]);
  assert.match(updates[0].sql, /WHERE id = \? AND image IS \?/);
});

test('inline image migration validates every row before uploading any image', async () => {
  let uploads = 0;
  const database = {
    async all() {
      return [{id: 1, image: 'data:image/jpeg;base64,not-a-valid-image', seotags: null}];
    },
    async run() {
      assert.fail('invalid image must not update the database');
    },
  };

  await assert.rejects(
    migrateInlineListingMedia({
      database,
      async putBlob() { uploads += 1; },
    }),
    /LISTING_IMAGE_INVALID/,
  );
  assert.equal(uploads, 0);
});
