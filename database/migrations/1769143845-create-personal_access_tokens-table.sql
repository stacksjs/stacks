CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "token" TEXT,
  "plain_text_token" TEXT,
  "abilities" TEXT,
  "last_used_at" TEXT,
  "expires_at" TEXT,
  "revoked_at" TEXT,
  "ip_address" TEXT,
  "device_name" TEXT,
  "is_single_use" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);