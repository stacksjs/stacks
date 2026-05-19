CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  column_id INTEGER NOT NULL,
  board_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  due_date DATETIME,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS cards_column_id_index ON cards(column_id);
CREATE INDEX IF NOT EXISTS cards_board_id_index ON cards(board_id);
CREATE INDEX IF NOT EXISTS cards_column_position_index ON cards(column_id, position);
CREATE INDEX IF NOT EXISTS cards_archived_index ON cards(archived);
CREATE INDEX IF NOT EXISTS cards_due_date_index ON cards(due_date);
