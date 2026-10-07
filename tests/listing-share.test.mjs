import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { listingIdFromUrl, listingShareUrl, listingShareText, listingPhotoAddress, findSharedListing } from '../src/lib/listingShare.ts';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('public listing shares use a safe exact-listing URL and a WhatsApp-readable message', () => {
  const url = listingShareUrl(42);
  assert.equal(url, 'https://www.pazartarla.com.tr/?ilan=42');
  assert.equal(listingIdFromUrl(url), '42');

  const text = listingShareText({ id: 42, title: 'Ceviz & badem', price: 1500, location: 'İzmir' });
  assert.ok(text.includes(url));
  assert.equal(new URL(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`).searchParams.get('text'), text);
});

test('unsafe identifiers cannot create listing URLs', () => {
  for (const id of [null, undefined, '', '42&magaza=private', '<script>', 'a'.repeat(129)]) {
    assert.throws(() => listingShareUrl(id));
  }
  assert.equal(listingIdFromUrl('https://www.pazartarla.com.tr/'), null);
  assert.equal(listingIdFromUrl('https://www.pazartarla.com.tr/?ilan=%3Cscript%3E'), null);
});

test('photo address is the active gallery image and does not require downloading', () => {
  assert.equal(listingPhotoAddress({ images: ['https://cdn.example/current.jpg', 'https://cdn.example/next.jpg'] }), 'https://cdn.example/current.jpg');
  assert.equal(listingPhotoAddress({ images: ['', '/images/listing.jpg'] }, 'https://www.pazartarla.com.tr/?ilan=42'), 'https://www.pazartarla.com.tr/images/listing.jpg');
  assert.equal(listingPhotoAddress({ images: ['data:image/png;base64,abc'] }), null);
  assert.equal(listingPhotoAddress({ image: 'https://user:pass@example.com/image.jpg' }), null);
});

test('incoming links open only the exact approved listing', () => {
  const rows = [{ id: 42, status: 'approved' }, { id: 43, status: 'pending' }];
  assert.equal(findSharedListing(rows, '42'), rows[0]);
  assert.equal(findSharedListing(rows, '43'), null);
  assert.equal(findSharedListing(rows, '999'), null);
});

test('listing detail exposes copyable photo and listing addresses and embeds the listing link in WhatsApp', () => {
  assert.ok(source.includes('encodeURIComponent(listingShareText(selectedListing))'));
  assert.ok(source.includes('findSharedListing(listings,linkedListingId)'));
  assert.ok(source.includes('url.searchParams.set(\'ilan\',listingId)'));
  assert.ok(source.includes('Fotoğraf adresini kopyala'));
  assert.ok(source.includes('onFocus={event=>event.currentTarget.select()}'));
  assert.ok(source.includes('Bağlantıyı kopyala'));
  assert.ok(source.includes('navigator.clipboard.writeText(address)'));
});
