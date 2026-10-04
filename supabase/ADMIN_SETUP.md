# Configure the listing administrator

**Safety first:** DATA_PROTECTION.md overrides historical production apply/test instructions. Never replay historical migrations or run fixtures on live data.

The policy migration creates an empty private allowlist. It does not store an administrator email in this public repository.

1. Inspect the installed policies before applying anything. The files in `migrations/` are historical records, not a production installation script. Never replay them on an existing site. Follow `DATA_PROTECTION.md` for backups and reviewed changes.
2. Make sure a verified Supabase Auth email/password account exists for the administrator. Do not create a public sign-up flow for this account.
3. In the SQL Editor, add the administrator to the private allowlist. Replace the placeholder locally before running this statement; do not commit the personalized query:

    INSERT INTO private.listing_admins (email)
    VALUES (lower(trim('YOUR_ADMIN_EMAIL')))
    ON CONFLICT (email) DO NOTHING;

4. Sign in to the website's admin panel with that Supabase Auth account. The site will call public.is_listing_admin() and the database policies will independently enforce write access.

New submissions require a verified email account and start `pending`. Normal
members may submit at most three listings in a rolling 24 hours. Moderation or
deletion does not refund quota. Administrators may submit unlimited pending
listings. Anonymous INSERT, UPDATE and DELETE are revoked. Direct UPDATE/DELETE,
moderation and gallery/featured changes require the private admin allowlist;
owners correct their own listing only through the bounded, reapproval RPC.

## Additional reviewed hardening

`reviewed_changes/20261004_listing_admin_hardening.sql` resolves admin permission
from the current verified, non-anonymous, non-banned Auth account and private
allowlist, not just a possibly stale JWT email. It also rejects a member's
attempt to embed `isFeatured: true` in the gallery/SEO compatibility suffix on
insertion. Gallery and SEO data are preserved. It does not update existing rows.
Run `pnpm run check:admin` for synthetic tests on a temporary local PostgreSQL
socket, including reconnect/readback of admin edit, feature and delete results,
legacy permissive policy bypass attempts and concurrent quota enforcement.
This command never reads production credentials or connects to Supabase.

The new SQL is **not applied automatically**. Before live application, take and
verify the encrypted backup, test the reviewed change, obtain explicit approval
and use the authorized Supabase maintenance process. Check function ownership
and the actual grants/RLS afterward. Do not claim this hardening is active on
the live site until that step has been completed.

## Preview and release order

- Scope VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to both Preview and Production in the Vercel project. A successful preview build without these settings does not demonstrate working sign-in.
- Rebuild the preview after changing environment-variable scopes; existing builds do not receive updated settings.
- Historical admin policies disable legacy PIN-based listing updates and deletes. Public submissions remain pending until admin approval.
- Confirm that anonymous update/delete requests are denied and public listing reads still work. Confirm that an authenticated allowlisted administrator passes is_listing_admin and a non-admin account does not.
- The production website is the www domain served by the pazartarla-1 Vercel project. Do not promote another linked project or alter the separate apex-domain deployment.
- Keep administrator email addresses, passwords, and personalized allowlist queries out of this repository.
