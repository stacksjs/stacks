CREATE TABLE IF NOT EXISTS "team_members" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "team_id" INTEGER not null REFERENCES "teams"("id"),
  "user_id" INTEGER not null REFERENCES "users"("id"),
  "role" TEXT CHECK ("role" IN ('owner', 'admin', 'member', 'viewer')) not null default 'member',
  "status" TEXT CHECK ("status" IN ('active', 'suspended')) not null default 'active',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_team_members_team_user_unique" ON "team_members" ("team_id", "user_id");
CREATE INDEX IF NOT EXISTS "team_members_team_members_user_status_index" ON "team_members" ("user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_team_members_uuid_unique" ON "team_members" ("uuid");
