-- #2923 — errors.status meant two things; split the triage half into resolution
--
-- Until now one column carried both the HTTP status an error reported and
-- where it sat in triage. The Error model seeds it as an HTTP status (400-500)
-- while resolveGroup wrote 1, ignoreGroup wrote 2 and unresolveGroup wrote 0
-- into the same place. Two consequences, both live:
--
--   1. Resolving an error destroyed its HTTP status. 500 became 1 and the
--      original was not recorded anywhere else.
--   2. A seeded error could never read as resolved, because no factory row is
--      ever exactly 1, so the dashboard showed every error as unresolved and
--      the triage buttons looked like they did nothing.
--
-- The ADD COLUMN that precedes this already defaulted every row to
-- 'unresolved', so only the rows carrying a triage value need moving.
--
-- This is lossy in one direction and unavoidably so. A row resolved before
-- today had its HTTP status overwritten at that moment; there is nothing left
-- to recover. Those rows get their resolution and have status cleared, because
-- 1 is not an HTTP status and leaving it there would keep asserting something
-- untrue. A row that was never triaged keeps its status untouched.
--
-- Ordered so the reads happen before the clear.
UPDATE "errors" SET "resolution" = 'resolved' WHERE "status" = 1;
UPDATE "errors" SET "resolution" = 'ignored' WHERE "status" = 2;
UPDATE "errors" SET "status" = NULL WHERE "status" IN (0, 1, 2);
