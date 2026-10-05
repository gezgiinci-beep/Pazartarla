# Fourth option: 30 Gün Ücretsiz Deneme

Reviewed candidate, **not installed live**. Prerequisite: the existing membership
setup and reviewed annual-unlimited upgrade, in that order.

- Each verified account can submit its store details and activate one free trial
  immediately. No bank transfer, card or administrator membership approval.
- Exactly 30 days of unlimited new submissions and active listings; ordinary
  listing moderation, ownership protection and eight-month expiry remain.
- The permanent private ledger prevents retries, simultaneous requests, expiry,
  paid upgrades or another request ID from restarting the trial.
- Expiration does not delete stores, listings or media, does not renew membership
  and does not automatically charge. A later paid package is a separate
  bank-transfer request with verified administrator approval.
- Trial requests cannot be sent through the paid approval path. No false payment
  record is created for free activation. Billing terms come from the server.
- The v3 reader includes four choices and only the caller's trial-use flag.
  Older v2 clients retain the three paid choices, and v1 retains two monthly
  choices. Until the new RPC is installed, the UI explicitly marks trial setup
  as pending and cannot submit a trial.
- A paid activation after trial clears the trial-duration marker, but retains
  the permanent one-use ledger and historic trial snapshot.

Activation needs a verified encrypted backup, separate live-SQL approval and
an isolated www frontend release based on its actual current Vercel/GitHub
source. Do not publish the entire development App, modify the apex host or
activate unrelated private-offer changes. The reviewed SQL preserves existing
catalog/payment terms and recompiles public wrappers after moving the all-data
reader into a private helper; execute only the reviewed sequence, not historical
setup again after the upgrades.

Offline verification:

```sh
node --experimental-strip-types --test tests/free-store-trial.test.mjs tests/annual-store-plan.test.mjs tests/store-memberships.test.mjs tests/membership-access.test.mjs
node scripts/check-annual-store-plan-local.mjs
pnpm run build
```

The disposable PostgreSQL check covers both upgrades, concurrent trial starts,
lost-ack retries, verified-account gating, true unlimited quotas, expiration,
paid transition, old-client compatibility and original-listing/media preservation.
