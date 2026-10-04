import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const startupEffect = [...source.matchAll(
  /  useEffect\(\(\) => \{\n[\s\S]*?\n  \}, \[\]\);/g,
)].map(match => match[0]).find(effect => effect.includes('setShowSplash(false)'));

assert.ok(startupEffect, 'A mount effect must dismiss the splash screen.');

let cleanup;
let scheduledTimer;
let splashVisible = true;
let listingFetches = 0;
let timerCleared = false;
const timerHandle = 17;

runInNewContext(startupEffect, {
  useEffect(effect) {
    cleanup = effect();
  },
  window: {
    setTimeout(callback, delay) {
      scheduledTimer = { callback, delay };
      return timerHandle;
    },
    clearTimeout(handle) {
      assert.equal(handle, timerHandle);
      timerCleared = true;
    },
  },
  setShowSplash(value) {
    splashVisible = value;
  },
  fetchListings() {
    listingFetches += 1;
    // An unresolved request must not prevent the splash from closing.
    return new Promise(() => {});
  },
});

assert.equal(listingFetches, 1, 'Listings must be loaded immediately on mount.');
assert.equal(scheduledTimer?.delay, 3500);
assert.equal(splashVisible, true);
scheduledTimer.callback();
assert.equal(splashVisible, false, 'The splash must close even while data is loading.');
assert.equal(typeof cleanup, 'function');
cleanup();
assert.equal(timerCleared, true, 'Unmount must cancel the splash timer.');

console.log('Startup checks passed: splash dismissal, initial listing load, and timer cleanup.');