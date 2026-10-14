# Reviewed listing-expiry change

This forward SQL rebuilds the generated `expires_at` value from the original
submission date, changing the lifetime from eight to twelve calendar months in
the Europe/Istanbul timezone.

It does not delete or rewrite listing rows, owners, statuses, text, or media.
Approved listings between eight and twelve months old will become publicly
visible again after the SQL is applied.

The change is **not applied**. First validate it against an isolated test
project with synthetic data, then take and verify an encrypted production
backup, and use the approved www-only release path. Do not put this file in the
automatic migration directory or apply it directly to production.
