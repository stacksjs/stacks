CREATE TABLE IF NOT EXISTS board_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  card_limit INTEGER,
  color TEXT NOT NULL DEFAULT 'slate',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS board_columns_board_id_index ON board_columns(board_id);
CREATE INDEX IF NOT EXISTS board_columns_board_position_index ON board_columns(board_id, position);
