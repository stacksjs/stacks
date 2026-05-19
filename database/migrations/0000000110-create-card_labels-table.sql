CREATE TABLE IF NOT EXISTS card_labels (
  card_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (card_id, label_id)
);
CREATE INDEX IF NOT EXISTS card_labels_label_id_index ON card_labels(label_id);
