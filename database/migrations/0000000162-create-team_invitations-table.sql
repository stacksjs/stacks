CREATE TABLE IF NOT EXISTS "team_invitations" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "team_id" INTEGER not null REFERENCES "teams"("id"),
  "email" TEXT not null,
  "role" TEXT CHECK ("role" IN ('admin', 'member', 'viewer')) not null default 'member',
  "token_hash" TEXT not null,
  "invited_by_user_id" INTEGER,
  "accepted_by_user_id" INTEGER,
  "status" TEXT CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired')) not null default 'pending',
  "delivery_status" TEXT CHECK ("delivery_status" IN ('pending', 'sent', 'failed')) not null default 'pending',
  "delivery_error" TEXT,
  "expires_at" TEXT not null,
  "delivered_at" TEXT,
  "accepted_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_team_invitations_token_hash_unique" ON "team_invitations" ("token_hash");
CREATE INDEX IF NOT EXISTS "team_invitations_team_invitations_team_email_status_index" ON "team_invitations" ("team_id", "email", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "team_invitations_team_invitations_uuid_unique" ON "team_invitations" ("uuid");
