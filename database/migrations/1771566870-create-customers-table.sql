CREATE TABLE IF NOT EXISTS "customers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "total_spent" REAL default 0,
  "last_order" TEXT,
  "status" TEXT default 'Active',
  "avatar" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);