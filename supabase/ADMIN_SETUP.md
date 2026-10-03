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
