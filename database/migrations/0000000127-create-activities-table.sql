CREATE TABLE IF NOT EXISTS "activities" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT not null,
  "description" TEXT not null,
  "subject_type" TEXT,
  "subject_id" INTEGER,
  "causer" TEXT,
  "properties" TEXT,
  "ip_address" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "activities_activities_uuid_unique" ON "activities" ("uuid");
