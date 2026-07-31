PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_print_devices" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "mac_address" TEXT not null,
  "location" TEXT not null,
  "terminal" TEXT not null,
  "status" TEXT CHECK ("status" IN ('online', 'offline', 'warning')) not null,
  "last_ping" INTEGER default 0,
  "print_count" INTEGER default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_print_devices" ("id", "name", "mac_address", "location", "terminal", "status", "last_ping", "print_count", "created_at", "updated_at", "uuid") SELECT "id", "name", "mac_address", "location", "terminal", "status", "last_ping", "print_count", "created_at", "updated_at", "uuid" FROM "print_devices";
DROP TABLE "print_devices";
ALTER TABLE "_qb_tmp_print_devices" RENAME TO "print_devices";
CREATE UNIQUE INDEX IF NOT EXISTS "print_devices_print_devices_uuid_unique" ON "print_devices" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
