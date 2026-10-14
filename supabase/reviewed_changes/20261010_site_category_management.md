# Site category management RPC — reviewed candidate

This SQL supplies the preview/apply RPC contract already called by the www
administration UI. It supports adding, renaming, reordering, moving, and removing
subcategory options. Each change is previewed against a settings revision and
the exact affected listing IDs; the confirmation token expires after 10 minutes
and can be used once.

Applying an operation locks the settings row and listing table for the short
transaction, updates only `category` and `"subCategory"` on matching listings,
and updates the settings JSON in that same transaction. It never deletes
listings, photos, or unrelated listing fields. A deletion with matching listings
requires an explicit destination. Existing verified-admin checks are retained.

The migration is in `reviewed_changes`, not `migrations`: it creates executable
database functions and an internal token table, so it is deliberately excluded
from automatic migration safety approval. Do not apply it to Production until
the isolated test-database check passes and the owner has reviewed the SQL.
Applying it does not require a frontend rebuild if the current www bundle already
contains the category-management UI.
