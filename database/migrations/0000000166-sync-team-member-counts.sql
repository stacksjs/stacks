UPDATE "teams"
SET "member_count" = (
  SELECT COUNT(*)
  FROM "team_members"
  WHERE "team_members"."team_id" = "teams"."id"
    AND "team_members"."status" = 'active'
);
