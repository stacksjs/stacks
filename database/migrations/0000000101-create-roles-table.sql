CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  guard_name TEXT NOT NULL DEFAULT 'web',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS roles_name_guard_unique ON roles(name, guard_name);
