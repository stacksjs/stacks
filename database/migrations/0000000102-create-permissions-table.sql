CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  guard_name TEXT NOT NULL DEFAULT 'web',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS permissions_name_guard_unique ON permissions(name, guard_name);
