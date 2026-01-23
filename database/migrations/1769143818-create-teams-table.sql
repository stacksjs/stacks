CREATE TABLE IF NOT EXISTS "teams" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "company_name" TEXT,
  "email" TEXT,
  "billing_email" TEXT,
  "status" TEXT,
  "description" TEXT,
  "path" TEXT,
  "is_personal" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);