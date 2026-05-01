CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  member_count INTEGER DEFAULT 0,
  project_count INTEGER DEFAULT 0,
  lead_name TEXT,
  owner TEXT,
  user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_name_unique ON teams(name);
