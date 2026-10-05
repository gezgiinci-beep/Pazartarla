import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { copyListingImage } from '../src/lib/listingImageClipboard.ts';

function setup(blob = new Blob(['image'], { type: 'image/png' })) {
  const calls = { started: false, images: [], fetched: [] };
  const env = {
    baseUrl: 'https://www.pazartarla.com.tr/?ilan=42',
    fetchImage: async (url, options) => {
      calls.fetched.push({ url, options });
      return { ok: true, blob: async () => blob };
    },
    clipboard: { write(items) {
      calls.started = true;
      return Promise.all(items.map(item => item.data['image/png'])).then(images => { calls.images = images; });
    } },
    ClipboardItemCtor: class { constructor(data) { this.data = data; } },
    createBitmap: undefined,
    createCanvas: () => { throw new Error('PNG should not need a canvas'); },
  };
  return { calls, env };
}

test('copies image bytes from the photo address, not the address as text', async () => {
  const { calls, env } = setup();
  const result = copyListingImage('https://photos.example/public/42.png', env);
  assert.equal(calls.started, true, 'clipboard write begins within the click gesture');
  await result;
  assert.equal(calls.images[0].type, 'image/png');
  assert.equal(await calls.images[0].text(), 'image');
  assert.equal(calls.fetched[0].url, 'https://photos.example/public/42.png');
  assert.equal(calls.fetched[0].options.credentials, 'omit');
});

test('JPEG photo becomes PNG for image clipboard and closes the decoder', async () => {
  const { calls, env } = setup(new Blob(['jpeg'], { type: 'image/jpeg' }));
  let closed = false;
  env.createBitmap = async () => ({ width: 3, height: 4, close: () => { closed = true; } });
  env.createCanvas = () => ({
    getContext: () => ({ drawImage() {} }),
    toBlob: callback => callback(new Blob(['converted'], { type: 'image/png' })),
  });
  await copyListingImage('https://photos.example/42.jpg', env);
  assert.equal(calls.images[0].type, 'image/png');
  assert.equal(await calls.images[0].text(), 'converted');
  assert.equal(closed, true);
});

test('unsupported clipboard, unsafe URLs, and inaccessible photos report failure', async () => {
  const { env } = setup();
  assert.throws(() => copyListingImage('https://photos.example/42.png', { ...env, clipboard: undefined }), /desteklemiyor/);
  assert.throws(() => copyListingImage('javascript:alert(1)', env), /güvenli değil/);
  assert.throws(() => copyListingImage('http://photos.example/42.jpg', env), /güvenli değil/);
  assert.throws(() => copyListingImage('data:text/html;base64,WA==', env), /desteklenmiyor/);
  await assert.rejects(copyListingImage('https://photos.example/42.png', {
    ...env, fetchImage: async () => ({ ok: false }),
  }), /erişilemedi/);
});

test('gallery selection and copy control use the currently displayed image', () => {
  const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('copyListingImage(photoUrl)'));
  assert.ok(source.includes('selectedListing.images?.[0] || selectedListing.image'));
  assert.ok(source.includes('Fotoğrafı kopyala'));
});
