CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS labels_board_id_index ON labels(board_id);
CREATE UNIQUE INDEX IF NOT EXISTS labels_board_name_unique ON labels(board_id, name);
