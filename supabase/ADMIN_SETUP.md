# Configure the listing administrator

The policy migration creates an empty private allowlist. It does not store an administrator email in this public repository.

1. In the Supabase dashboard, open the project's SQL Editor and run the migration in migrations/20261003_secure_listing_admin.sql.
2. Make sure a verified Supabase Auth email/password account exists for the administrator. Do not create a public sign-up flow for this account.
3. In the SQL Editor, add the administrator to the private allowlist. Replace the placeholder locally before running this statement; do not commit the personalized query:

    INSERT INTO private.listing_admins (email)
    VALUES (lower(trim('YOUR_ADMIN_EMAIL')))
    ON CONFLICT (email) DO NOTHING;

4. Sign in to the website's admin panel with that Supabase Auth account. The site will call public.is_listing_admin() and the database policies will independently enforce write access.

The public listing form continues to allow approved listing submissions as it did before. Anonymous UPDATE and DELETE are revoked; only authenticated allowlisted administrators can update or delete rows.

## Preview and release order

- Scope VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to both Preview and Production in the Vercel project. A successful preview build without these settings does not demonstrate working sign-in.
- Rebuild the preview after changing environment-variable scopes; existing builds do not receive updated settings.
- Applying the migration immediately disables legacy PIN-based listing updates and deletes. Public approved listing submissions remain enabled.
- Confirm that anonymous update/delete requests are denied and public listing reads still work. Confirm that an authenticated allowlisted administrator passes is_listing_admin and a non-admin account does not.
- The production website is the www domain served by the pazartarla-1 Vercel project. Do not promote another linked project or alter the separate apex-domain deployment.
- Keep administrator email addresses, passwords, and personalized allowlist queries out of this repository.
