# Bulk contact import

Apply `20261004_contact_bulk_import.sql` after the contact-depot migration.
Additive private receipts/indexes and guarded RPCs preserve existing listing
approval, quota, ownership, photos, contacts and consent records. A separate
contact-field listing trigger participates in the existing directory mutation
lock so automatic capture cannot race the import duplicate check.

Admin UI accepts CSV and Excel **.xlsx** (old .xls must be saved as .xlsx).
Max 2 MB, 50 MB expanded ZIP metadata, 5,000 people per sheet, 50 columns, 10 sheets. CSV supports auto-detected
comma/semicolon/tab delimiters, quoted fields, UTF-8/BOM, Turkish Windows-1254,
and BOM-marked UTF-16. Excel worksheets are selectable. Recognized Turkish/
English headers map automatically; dropdowns override mapping. First and last
name join into the existing directory name field. Use text cells for telephone
numbers, especially international `+countrycode` numbers. Never guess unknown
country codes, omitted legacy email or ownership.

Files are parsed locally, not uploaded to persistent storage or third-party
parsing APIs. Raw source files and preview PII are not retained in localStorage,
logs or analytics. Only normalized rows go to the authenticated admin RPCs.

Preview performs no contact writes. A row needs a valid name and at least one
valid endpoint; populated malformed endpoints/type errors reject the whole row.
Later duplicate email **OR** normalized phone in a file is skipped. The server
checks either endpoint against all existing contacts, including archived rows.
This is deliberately stricter than the directory's existing pair identity.
There is no fuzzy-name matching, merge, overwrite, archive restore, permission
grant or automatic message send. Imported contacts are manually curated entries
with all messaging channels unknown.

Save requires explicit confirmation. Requests run sequentially in 200-row
atomic batches, rechecking current duplicates to handle changes since preview.
Each batch has a stable `UUID:offset` ID and input SHA-256 digest. A private
owner-bound receipt returns the original per-row result on repeated requests,
even if the response was lost after commit; changed payload/owner is refused.
Reports retain row ordinals/status/reasons only, not copies of uploaded values.

Multiple batches are not an all-file transaction: an interrupted import may
already have saved confirmed earlier batches. UI reports partial counts and
resumes the failed batch with the same ID; do not imply rollback of earlier
successes. After page reload/reupload, normal duplicate checks skip saved
contacts without overwrite. Completed import refreshes the shared directory.

Verification:
- `node --experimental-strip-types --test tests/contact-import.test.mjs tests/contact-depot.test.mjs`
- `node scripts/check-contact-import-database.mjs` rollback-only; `--apply` commits
  only additive schema after the checks. No real files/messages are submitted.
- `tests/bulk-browser.html` is a **synthetic** component harness, not an auth
  bypass or production entry. Optional `?fail_after_commit=1` simulates lost batch
  acknowledgement. Real administrator sign-in must be verified separately;
  no administrator browser credentials were available during implementation.

Publish frontend only with separate approval for the www Vercel project.