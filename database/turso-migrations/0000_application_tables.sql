-- Create the application and private tables that were imported from Supabase.
-- This migration runs before 0001/0002 on an empty production database.  The
-- member-store publication column is intentionally left to 0002.
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_confirmed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  banned_until TEXT,
  deleted_at TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auth_login_limits (
  subject_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_verification', 'password_reset')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  admin_reauth_at TEXT
);

CREATE TABLE IF NOT EXISTS pazartarla_auth_migration_manifest (
  migration_name TEXT PRIMARY KEY,
  account_count INTEGER NOT NULL,
  verified_count INTEGER NOT NULL,
  admin_count INTEGER NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pazartarla_migration_manifest (
  source_schema TEXT NOT NULL,
  source_table TEXT NOT NULL,
  target_table TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  verified_at TEXT NOT NULL,
  PRIMARY KEY (source_schema, source_table)
);

CREATE TABLE IF NOT EXISTS private__listing_admins (
  email TEXT NOT NULL PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__listing_submission_log (
  id INTEGER NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__listing_offer_settings (
  listing_id INTEGER NOT NULL PRIMARY KEY,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__listing_offers (
  id TEXT NOT NULL PRIMARY KEY,
  listing_id INTEGER NOT NULL,
  title_snapshot TEXT NOT NULL,
  seller_phone_snapshot TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  counter_amount NUMERIC,
  quantity TEXT NOT NULL,
  note TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__listing_offer_messages (
  id TEXT NOT NULL PRIMARY KEY,
  offer_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__member_stores (
  id TEXT NOT NULL PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  revision INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private__store_memberships (
  owner_id TEXT NOT NULL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  monthly_limit INTEGER,
  active_limit INTEGER,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  revision INTEGER NOT NULL,
  billing_period TEXT NOT NULL,
  trial_days INTEGER
);

CREATE TABLE IF NOT EXISTS private__store_requests (
  id TEXT NOT NULL PRIMARY KEY,
  owner_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  monthly_price_try NUMERIC,
  monthly_limit INTEGER,
  active_limit INTEGER,
  store_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  billing_period TEXT NOT NULL,
  annual_price_try NUMERIC,
  trial_days INTEGER
);

CREATE TABLE IF NOT EXISTS private__store_plans (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_try NUMERIC,
  monthly_limit INTEGER,
  active_limit INTEGER,
  billing_period TEXT NOT NULL,
  annual_price_try NUMERIC,
  trial_days INTEGER
);

CREATE TABLE IF NOT EXISTS private__store_trial_ledger (
  owner_id TEXT NOT NULL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__store_payment_log (
  reference TEXT NOT NULL PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  approved_by TEXT NOT NULL,
  amount_try NUMERIC NOT NULL,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__membership_activation_receipts (
  id TEXT NOT NULL PRIMARY KEY,
  applied_at TEXT NOT NULL,
  project TEXT NOT NULL,
  reviewed_changes TEXT NOT NULL,
  backup_receipt TEXT NOT NULL,
  restore_drill_waived INTEGER NOT NULL,
  restore_drill_verified INTEGER NOT NULL,
  protected_tables_verified INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private__traffic_config (
  id INTEGER NOT NULL PRIMARY KEY,
  collection_started_at TEXT NOT NULL,
  last_purged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__traffic_views (
  view_id TEXT NOT NULL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  route TEXT NOT NULL,
  listing_id INTEGER,
  country TEXT,
  region TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  active_seconds INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_campaigns (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS private__depot_channels (
  channel TEXT NOT NULL PRIMARY KEY,
  provider TEXT,
  enabled INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_contacts (
  id TEXT NOT NULL PRIMARY KEY,
  identity_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  raw_phone TEXT,
  manual INTEGER NOT NULL,
  from_listing INTEGER NOT NULL,
  archived INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_deliveries (
  id TEXT NOT NULL PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  lease TEXT,
  lease_until TEXT,
  provider_id TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (campaign_id, destination)
);

CREATE TABLE IF NOT EXISTS private__depot_import_receipts (
  request_id TEXT NOT NULL PRIMARY KEY,
  actor TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_optout_links (
  token TEXT NOT NULL PRIMARY KEY,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_permission_events (
  id INTEGER NOT NULL PRIMARY KEY,
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence TEXT NOT NULL,
  actor TEXT,
  recorded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_permissions (
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence TEXT NOT NULL,
  updated_at TEXT,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  PRIMARY KEY (contact_id, channel)
);

CREATE TABLE IF NOT EXISTS private__depot_sources (
  listing_id INTEGER NOT NULL PRIMARY KEY,
  contact_id TEXT NOT NULL,
  captured_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private__depot_suppressions (
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (channel, destination)
);

CREATE INDEX IF NOT EXISTS private__listing_submission_user_time_idx
  ON private__listing_submission_log(user_id, submitted_at);

CREATE INDEX IF NOT EXISTS private__listing_offers_buyer_time_idx
  ON private__listing_offers(buyer_id, created_at);

CREATE INDEX IF NOT EXISTS private__listing_offers_seller_time_idx
  ON private__listing_offers(seller_id, created_at);

CREATE INDEX IF NOT EXISTS private__listing_offers_listing_status_idx
  ON private__listing_offers(listing_id, status, created_at);

CREATE INDEX IF NOT EXISTS private__listing_offer_messages_offer_time_idx
  ON private__listing_offer_messages(offer_id, created_at);

CREATE INDEX IF NOT EXISTS private__store_requests_owner_created_idx
  ON private__store_requests(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS private__store_requests_status_created_idx
  ON private__store_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS private__depot_deliveries_status_lease_idx
  ON private__depot_deliveries(status, lease_until);

CREATE INDEX IF NOT EXISTS private__traffic_views_updated_idx
  ON private__traffic_views(updated_at DESC);
