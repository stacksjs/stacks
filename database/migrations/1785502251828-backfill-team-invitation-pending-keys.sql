-- Keep the newest invitation active when historical data contains duplicate pending rows.
UPDATE "team_invitations"
SET
  "status" = 'expired',
  "pending_key" = NULL,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "status" = 'pending'
  AND "id" NOT IN (
    SELECT MAX("id")
    FROM "team_invitations"
    WHERE "status" = 'pending'
    GROUP BY "team_id", LOWER(TRIM("email"))
  );

UPDATE "team_invitations"
SET "pending_key" = CAST("team_id" AS TEXT) || ':' || LOWER(TRIM("email"))
WHERE "status" = 'pending';
