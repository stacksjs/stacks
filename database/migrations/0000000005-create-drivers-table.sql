CREATE TABLE IF NOT EXISTS "drivers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "phone" TEXT,
  "vehicle_number" TEXT,
  "license" TEXT,
  "status" TEXT CHECK ("status" IN ('active', 'on_delivery', 'on_break')) default 'active',
  "user_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);