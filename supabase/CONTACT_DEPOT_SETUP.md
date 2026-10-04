# Private contact depot and future messaging

Apply `20261004_contact_depot.sql` before publishing the frontend. It only adds
private contact/permission/campaign/delivery/suppression tables and functions,
and an AFTER listing insert/contact-field-update trigger. Existing listing
approval, quotas, ownership, dates, storage and authentication stay intact.
Initial backfill captures existing advertiser name/phone, and verified recorded
submitter email when known. Do not infer missing legacy emails. Administrator
accounts can post for other sellers: their private account email is not copied.
New verified submitter emails never appear in public listings.

## Identity and management
Canonical lowercase email plus normalized E.164 phone identifies a contact
destination pair. Exact duplicates are refused on manual create, reused for
automatic capture. Different pairs may represent the same person; do not merge
just because a name, shared phone or email matches. Legacy malformed phone is
kept as raw text for correction, never eligible for sending. No anonymous
browser analytics identity is connected to contact records.

Administrators can create/edit/search, paginate 50 records, record individual
channel permissions with evidence, archive and restore. Server revisions reject
stale writes from other sessions. Destination edits revoke that channel's
permissions and pending deliveries; automatic capture preserves manual name
curation. Archiving revokes permissions but does not delete listings. Contact
records are independent of the eight-month listing archive. Choose retention/
erasure policy before running marketing campaigns; no legal-compliance guarantee
is made merely by storing a checkbox or evidence text.

## Permission and opt-out
Advertiser/manual entry is NOT marketing consent. All channels start unknown.
Only a separate recorded permission and valid endpoint permits eligibility.
Manual grant needs an actual source/date/evidence, not assumed consent. An
administrator is responsible for validating applicable consent/IYS obligations.
Permission events are private and record server timestamps and authorized actor.

Random channel-specific unsubscribe tokens never appear in contact-reader
responses. Future outbound messages must include a verified HTTPS URL:
`?iletisim_cikis=<token>`. The public UI requires a deliberate confirmation, not
GET side effects, to avoid link-scanner cancellation. Opt-out is destination-wide
for the channel: duplicate pairs cannot bypass withdrawal. It revokes existing
matching permissions and cancels queued deliveries. New explicit evidence can
regrant a permission, but never restarts previously cancelled campaigns.
Messages already in progress cannot be recalled.
Unsubscribe capabilities are permanently bound to the original destination,
not mutable contact fields: changing an email/phone issues a new channel token;
old message links still withdraw the old destination, never a new recipient.

## Actual infrastructure vs pending connections
- SMS, email and WhatsApp channel configurations exist but are **disabled**.
  No credential, fake connection, fabricated send or external message is created.
- Admin campaign creation snapshots only active, granted, valid destinations,
  deduplicates per channel/destination and stores UTC scheduled time. Max 10,000
  recipients and 2,000 message characters; recent 20 campaigns shown.
- Disconnected channel campaigns are `blocked_provider`, not sent. Connecting
  a provider does not auto-release old blocked drafts: cancel/recreate with
  deliberate approval after activation. Current release has no sending cron.
- Service-role-only worker RPCs claim up to 25 due deliveries with row leases/
  SKIP LOCKED, then recheck current permissions, endpoint, channel and campaign
  before dispatch. `server/messageDispatcher.ts` requires an actual injected
  transport and always supplies stable idempotency and unsubscribe context.
- Successful provider acknowledgement means accepted/sent, not proof of
  delivery/read. Failed responses are failed; ambiguous network/crash outcomes
  become unknown and are never blindly replayed. A lost completion acknowledgement
  fails explicitly; leases retain the unknown state rather than resending.
- Actual provider adapter, server-only credential binding, trusted scheduler,
  sender/domain/number verification, provider callbacks and WhatsApp approved
  business templates must be configured with the chosen accounts before
  enabling channels. WhatsApp draft text is not permission to send unsolicited
  free-form business messages outside provider rules.

Available connection options were found for Twilio (SMS), Resend/SendGrid
(email), Bird and WhatsApp Business. Do not silently choose one. Connect the
user's chosen accounts through the integration flow; never put secrets in Vite
variables or ask for keys in chat. The external Vercel runtime needs a secure
server binding, not an editor-only connection. No privileged server credential
currently exists in the www Vercel project; public key cannot run worker RPCs.

## Verification
`node --experimental-strip-types --test tests/contact-depot.test.mjs`
`node scripts/check-contact-depot-database.mjs` — rollback-only checks, no transport.
`--apply` explicitly commits the additive schema/backfill only after checks pass.
All fixture listing/contact/campaign/consent events are rolled back. Production
publication of the frontend still needs separate approval for the www project.