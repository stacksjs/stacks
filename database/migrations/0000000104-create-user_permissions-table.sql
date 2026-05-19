CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id)
);
CREATE INDEX IF NOT EXISTS user_permissions_permission_id_index ON user_permissions(permission_id);
