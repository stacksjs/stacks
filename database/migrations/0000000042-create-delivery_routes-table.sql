CREATE TABLE IF NOT EXISTS "delivery_routes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "driver" TEXT,
  "vehicle" TEXT,
  "stops" REAL,
  "delivery_time" REAL,
  "total_distance" REAL,
  "last_active" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);