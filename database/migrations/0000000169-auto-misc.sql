PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "queue" TEXT not null,
  "payload" TEXT not null,
  "attempts" INTEGER,
  "available_at" INTEGER,
  "reserved_at" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_jobs" ("id", "queue", "payload", "attempts", "available_at", "reserved_at", "created_at", "updated_at") SELECT "id", "queue", "payload", "attempts", "available_at", "reserved_at", "created_at", "updated_at" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "_qb_tmp_jobs" RENAME TO "jobs";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
