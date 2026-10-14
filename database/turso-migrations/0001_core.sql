CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  mode TEXT,
  location TEXT,
  amount TEXT,
  description TEXT,
  seller TEXT NOT NULL,
  phone TEXT NOT NULL,
  image TEXT,
  seotags TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "subCategory" TEXT,
  submitted_by TEXT,
  expires_at TEXT,
  is_featured INTEGER CHECK (is_featured IS NULL OR is_featured IN (0, 1)),
  gallery_paths TEXT
);

CREATE INDEX IF NOT EXISTS listings_public_created_idx
  ON listings(status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS listings_submitter_created_idx
  ON listings(submitted_by, created_at DESC);

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY CHECK (id = 'public'),
  announcement TEXT NOT NULL CHECK (length(announcement) <= 1000),
  categories TEXT NOT NULL CHECK (json_valid(categories)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  featured_offer TEXT NOT NULL CHECK (json_valid(featured_offer))
);

CREATE TABLE IF NOT EXISTS advertisements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (
    length(trim(title)) BETWEEN 1 AND 120 AND title = trim(title)
  ),
  target_url TEXT,
  media_path TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS app_schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
