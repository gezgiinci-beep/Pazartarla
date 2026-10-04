# Advertisement management

Apply `migrations/20261004_advertisements.sql` after the existing administrator
migration. It adds advertisement metadata and a dedicated Supabase Storage bucket,
without changing listings, accounts, or shared announcement/category settings.

This app is deployed as a standalone Vite frontend on Vercel, not the workspace's
Express/Replit template. It therefore uses its existing Supabase authentication,
database and Storage API; no second authentication system or Replit-side server is required.
File bytes are never placed in PostgreSQL or the listing SEO metadata.

Administrators enter **Reklam Yönetimi — Görsel / Video Yükle** from their panel.
They can upload JPG/PNG/WEBP images (up to 10 MB) or MP4/WEBM videos (up to 50 MB),
set a title and optional destination URL, publish/pause, edit metadata and delete.
Videos have playback controls and never autoplay. File replacement requires
creating a new advertisement, then removing the old one if desired.

Only database-authorized administrators can upload/delete media or mutate
advertisement records. Visitors read published records only. Media URLs are
public even for paused advertisements; pausing hides the placement, not the file.
Deletion first confirms the record deletion, then uses Storage API to remove media.
Cleanup failures are explicit and can be retried. Ambiguous insert failures keep
and reuse the upload on retry rather than deleting a potentially referenced file.
Settings/listing features remain unchanged.

Checks:
- `pnpm check:ads`: standalone API/validation checks (Node 22.6+).
- `pnpm check:ads-db`: rollback-only policy/record/storage-metadata checks using
  `SUPABASE_DATABASE_URL` and the official CA (`SUPABASE_DATABASE_CA_FILE` or
  `/tmp/pazartarla-supabase-ca.crt`). No actual media files are created/deleted.
- `pnpm build`: production bundle.

Apply the additive setup before releasing the frontend. Do not promote Vercel
production without user approval; deployment scope is the existing www project only.