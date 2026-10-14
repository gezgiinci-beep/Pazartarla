import { listingIdFromUrl } from './listingShare.ts';
import { storeIdFromUrl } from './storeMembership.ts';

// URL selection takes precedence over stale history state. One resolver is
// shared by initial load and popstate so store and listing listeners cannot race.
export function readPublicNavigation(href, state = null) {
  const url = new URL(href);
  const listingId = listingIdFromUrl(href);
  const storeId = storeIdFromUrl(href);
  if (listingId) return { tab: 'detail', listingId, storeId: null, invalidStoreLink: false };
  if (url.pathname.replace(/\/+$/, '').split('/').at(-1) === 'admin') {
    return { tab: 'admin-page', listingId: null, storeId: null, invalidStoreLink: false };
  }
  if (url.searchParams.has('magaza')) {
    return { tab: 'store', listingId: null, storeId, invalidStoreLink: !storeId };
  }
  if (url.searchParams.get('teklifler') === '1') {
    return { tab: 'offers', listingId: null, storeId: null, invalidStoreLink: false };
  }
  if (url.searchParams.get('hakkimizda') === '1') {
    return { tab: 'about', listingId: null, storeId: null, invalidStoreLink: false };
  }
  const tab = typeof state?.tab === 'string' && !['store', 'detail'].includes(state.tab) ? state.tab : 'home';
  return { tab, listingId: null, storeId: null, invalidStoreLink: false };
}
