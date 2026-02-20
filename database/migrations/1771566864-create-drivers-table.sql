CREATE TABLE IF NOT EXISTS "drivers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "phone" TEXT,
  "vehicle_number" TEXT,
  "license" TEXT,
  "status" TEXT default 'active',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);