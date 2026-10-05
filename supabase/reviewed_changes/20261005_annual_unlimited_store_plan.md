# Paket 3: Sınırsız, 2.500 TL / yıl

This is a reviewed activation candidate, not evidence of a live deployment.
It upgrades the existing store-membership system only; no private-offer migration
or unrelated release is included.

- Keep the two monthly tiers and all existing payment/membership terms intact.
- Annual requests snapshot 2.500 TL, one calendar year and two genuinely unbounded
  quotas. Browser-supplied fees, limits and expiration dates are not trusted.
- Only a verified administrator's confirmed bank transfer activates a membership.
  Payment references and approval retries cannot activate or extend it twice.
- Unlimited membership is not an administrator role. Listing moderation,
  owner-only editing, original dates and eight-calendar-month expiry remain.
- Expired memberships revert to normal submission limits without deleting media
  or existing listings. A downgrade cannot silently remove excess listings.
- New clients read the v2 membership RPC. Until it is installed, a precisely
  identified missing-function response permits reading the legacy monthly RPC;
  the new annual card is promotional and explicitly unavailable.
- Legacy clients retain their supported monthly catalog and numeric request
  snapshots. Annual requests must be reviewed through the updated interface.

Before activation, confirm a verified encrypted backup and separate live SQL
approval, the installed store-membership prerequisite, and the www-only release
scope. Deploy the annual-aware frontend with its v2-compatible reader, then
activate only the matching reviewed SQL and confirm PostgREST's schema refresh.
Do not publish the whole development App or run unrelated pending migrations.

Offline checks (no real accounts, listings or external database credentials):

```sh
node --experimental-strip-types --test tests/annual-store-plan.test.mjs tests/store-memberships.test.mjs tests/membership-access.test.mjs
node scripts/check-annual-store-plan-local.mjs
node scripts/check-membership-local.mjs
pnpm run build
```
