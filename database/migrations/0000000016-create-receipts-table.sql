CREATE TABLE IF NOT EXISTS "receipts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "printer" TEXT,
  "document" TEXT,
  "timestamp" TEXT,
  "status" TEXT CHECK ("status" IN ('success', 'failed', 'warning')),
  "size" REAL,
  "pages" REAL,
  "duration" REAL,
  "metadata" TEXT,
  "print_device_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);