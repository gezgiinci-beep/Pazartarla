import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {clipboardImageFiles, imagePreviewFromUrl, readClipboardImages} from '../src/lib/remoteListingImages.mjs';
import {persistListingImages} from '../src/lib/listingMedia.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=', 'base64');
const originalReader = globalThis.FileReader;
globalThis.FileReader = class {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(bytes => {
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
      this.onload();
    }).catch(() => this.onerror());
  }
};
after(() => { globalThis.FileReader = originalReader; });

test('imports actual image bytes without local download, cookie forwarding or hotlink persistence', async () => {
  const preview = await imagePreviewFromUrl(' https://photos.example/image.png ', async (url, options) => {
    assert.equal(url, 'https://photos.example/image.png');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.mode, 'cors');
    assert.equal(options.headers, undefined);
    return new Response(png, {headers: {'content-type': 'image/png'}});
  });
  assert.equal(preview, `data:image/png;base64,${png.toString('base64')}`);
  let uploads = 0;
  const media = await persistListingImages([preview], {
    client: {storage: {from(bucket) {
      assert.equal(bucket, 'listing-media');
      return {async upload(path, blob) {
        uploads++;
        assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png);
        return {data: {path}, error: null};
      }};
    }}},
    baseUrl: 'https://example.supabase.co',
    userId: '00000000-0000-4000-8000-000000000019',
  });
  assert.equal(uploads, 1);
  assert.match(media.gallery_paths[0], /^listing-media\//);
  assert.ok(!JSON.stringify(media).includes('photos.example'));
  assert.ok(!JSON.stringify(media).includes('data:image'));
});

test('rejects unsafe URLs before contacting their source', async () => {
  for (const url of ['bad', '', 'http://photos.example/a.jpg', 'javascript:alert(1)', 'https://user:pass@photos.example/a.jpg', 'data:image/png;base64,abc']) {
    await assert.rejects(() => imagePreviewFromUrl(url, () => { throw new Error('must not fetch'); }), /https:\/\//);
  }
});

test('source errors and CORS denial remain explicit and do not create a gallery item', async () => {
  await assert.rejects(() => imagePreviewFromUrl('https://photos.example/image', async () => { throw new TypeError('CORS'); }), /kopyalayıp.*yapıştır/);
  await assert.rejects(() => imagePreviewFromUrl('https://photos.example/image', async () => new Response('', {status: 403})), /adres.*açılamadı/);
});

test('rejects HTML, SVG, spoofed image bytes and oversized streamed photos', async () => {
  for (const type of ['text/html', 'image/svg+xml']) {
    await assert.rejects(() => imagePreviewFromUrl('https://photos.example/image', async () => new Response('<html>', {headers: {'content-type': type}})), /JPEG/);
  }
  await assert.rejects(() => imagePreviewFromUrl('https://photos.example/image', async () => new Response('not an image', {headers: {'content-type': 'image/png'}})), /biçimi geçersiz/);
  await assert.rejects(() => imagePreviewFromUrl('https://photos.example/image', async () => new Response(new Uint8Array(2 * 1024 * 1024 + 1), {headers: {'content-type': 'image/png'}})), /2 MB/);
});

test('pasted images are accepted while pasted text and URLs are not mistaken for image files', () => {
  const file = new File([png], 'clipboard.png', {type: 'image/png'});
  assert.deepEqual(clipboardImageFiles({files: [file]}), [file]);
  assert.deepEqual(clipboardImageFiles({items: [{kind: 'file', type: 'image/png', getAsFile: () => file}]}), [file]);
  assert.deepEqual(clipboardImageFiles({files: [], items: [{kind: 'string', type: 'text/plain'}]}), []);
});

test('clipboard button imports photo bytes and explains unsupported or denied clipboard access', async () => {
  const previews = await readClipboardImages({async read() {
    return [{types: ['image/png'], async getType() { return new Blob([png], {type: 'image/png'}); }}];
  }});
  assert.match(previews[0], /^data:image\/png;base64,/);
  await assert.rejects(() => readClipboardImages({}), /yapıştırma alanını/);
  await assert.rejects(() => readClipboardImages({async read() { throw new Error('denied'); }}), /erişim izni/);
  await assert.rejects(() => readClipboardImages({async read() { return [{types: ['text/plain']}]; }}), /Panoda fotoğraf yok/);
});

test('creation and admin galleries support import without auto-submitting or retaining the old share-copy control', () => {
  const localRelease = new URL('../../../.local/releases/www-listing-share/App.tsx', import.meta.url);
  const paths = ['../src/App.tsx'];
  if (existsSync(localRelease)) paths.push('../../../.local/releases/www-listing-share/App.tsx');
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal((source.match(/<RemoteListingImages\b/g) || []).length, 2);
    assert.match(source, /onAdd=\{images => appendImportedPhotos\('form', images\)\}/);
    assert.match(source, /onAdd=\{images => appendImportedPhotos\('editingListing', images\)\}/);
    assert.match(source, /if \(submissionSaving \|\| formImageImporting\) return/);
    assert.match(source, /gallerySaving \|\| editImageImporting/);
    assert.doesNotMatch(source, /copyListingImage|photoCopyBusy/);
  }
  const component = readFileSync(new URL('../src/components/RemoteListingImages.tsx', import.meta.url), 'utf8');
  assert.match(component, /type="button"/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /latest\.current\.count \+ images\.length > 10/);
});

test('legacy www release transfers imported bytes to Storage before appending gallery references', t => {
  const path = new URL('../../../.local/releases/www-listing-share/App.tsx', import.meta.url);
  if (!existsSync(path)) { t.skip('Local release candidate is not part of the GitHub source tree.'); return; }
  const release = readFileSync(path, 'utf8');
  assert.match(release, /saved = await persistListingImages\(images/);
  assert.match(release, /combined = \[\.\.\.\(current\.images \|\| \[\]\), \.\.\.saved\.images\]/);
});
