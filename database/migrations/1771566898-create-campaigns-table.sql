CREATE TABLE IF NOT EXISTS "campaigns" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "type" TEXT,
  "status" TEXT default 'draft',
  "audience_size" REAL default 0,
  "sent_count" REAL default 0,
  "open_rate" REAL,
  "click_rate" REAL,
  "conversion_rate" REAL,
  "budget" REAL,
  "spent" REAL default 0,
  "start_date" TEXT,
  "end_date" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);