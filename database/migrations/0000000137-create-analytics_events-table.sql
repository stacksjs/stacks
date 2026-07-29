CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "category" TEXT not null default 'custom',
  "path" TEXT,
  "value" INTEGER default 0,
  "currency" TEXT not null default 'USD',
  "properties" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_events_analytics_events_uuid_unique" ON "analytics_events" ("uuid");
