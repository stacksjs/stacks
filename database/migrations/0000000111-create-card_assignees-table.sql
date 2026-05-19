CREATE TABLE IF NOT EXISTS card_assignees (
  card_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  assigned_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (card_id, user_id)
);
CREATE INDEX IF NOT EXISTS card_assignees_user_id_index ON card_assignees(user_id);
