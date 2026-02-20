CREATE TABLE IF NOT EXISTS "receipts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "printer" TEXT,
  "document" TEXT,
  "timestamp" TEXT,
  "status" TEXT,
  "size" REAL,
  "pages" REAL,
  "duration" REAL,
  "metadata" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "print_device_id" INTEGER REFERENCES "print_devices"("id")
);