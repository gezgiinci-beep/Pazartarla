# Featured listing notice

Apply `migrations/20261004_featured_offer.sql` to the existing external Supabase
database before releasing the frontend. This extends the singleton shared
`site_settings` record; it does not alter listings, images, announcements or
categories. Default price: **150 TL for one month**.

The public notice is shown on the homepage even with zero featured listings,
and on the submission page. Its button opens the existing business WhatsApp
contact with the current canonical monthly price. No checkout, payment
collection, automatic featuring or automatic one-month featured-status expiry
is introduced. Administrators continue managing featured flags manually.
The eight-month archive lifetime of a listing remains unchanged.

The protected administrator **Vitrin Ücreti** section edits the price and
description, with a live preview. Only the price notice is edited here.
Price supports two decimal places, must be positive and at most 1,000,000 TL;
description is at most 400 characters. Frontend and database validate the same
contract. Public/member writes are denied by the existing administrator RLS.

Saves update only `featured_offer` and use the existing revision check. Failed
or conflicting writes retain the draft; the explicit canonical reload button
adopts current server values. Fresh sessions read the same backend value.
Focused visible pages also refresh settings on focus/visibility and every minute.

Featured listings use three columns with automatic row flow and no height or
count cap: six listings produce two rows of three; additional listings continue
on subsequent rows. Never restore the old horizontal carousel.

Checks:
- `node --experimental-strip-types --test tests/site-settings.test.mjs tests/featured-layout.test.mjs`
- `node scripts/check-site-settings-database.mjs --with-featured-offer-migration`
  tests the proposed setup/permissions/pricing/conflicts in a rollback transaction.
- `pnpm build`.

Publication is a separate, approval-required action for the www Vercel project.