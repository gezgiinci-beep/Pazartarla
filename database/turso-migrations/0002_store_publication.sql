ALTER TABLE private__member_stores
  ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1));

CREATE INDEX IF NOT EXISTS private__member_stores_public_name_idx
  ON private__member_stores(is_public, name);
