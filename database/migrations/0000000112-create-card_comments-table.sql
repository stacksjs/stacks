CREATE TABLE IF NOT EXISTS card_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  card_id INTEGER NOT NULL,
  user_id INTEGER,
  body TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS card_comments_card_id_index ON card_comments(card_id);
CREATE INDEX IF NOT EXISTS card_comments_card_created_index ON card_comments(card_id, created_at);
