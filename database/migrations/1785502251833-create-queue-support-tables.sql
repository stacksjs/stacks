-- Queue durability tables used by batches, dead-letter handling, poison
-- detection, circuit breaking, and idempotent dispatch.
CREATE TABLE IF NOT EXISTS "job_batches" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT not null default '',
  "total_jobs" INTEGER not null default 0,
  "pending_jobs" INTEGER not null default 0,
  "failed_jobs" INTEGER not null default 0,
  "failed_job_ids" TEXT not null default '[]',
  "options" TEXT,
  "cancelled_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "finished_at" TEXT,
  "then_handler" TEXT,
  "catch_handler" TEXT,
  "finally_handler" TEXT
);

CREATE TABLE IF NOT EXISTS "dead_letter_jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT not null,
  "connection" TEXT not null,
  "queue" TEXT not null,
  "payload" TEXT not null,
  "exception" TEXT not null,
  "reason" TEXT not null,
  "total_failures" INTEGER not null default 1,
  "first_failed_at" TEXT,
  "last_failed_at" TEXT,
  "dead_lettered_at" TEXT not null default CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "job_quarantine" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "job_name" TEXT not null,
  "payload_hash" TEXT not null,
  "failure_count" INTEGER not null default 0,
  "window_start" TEXT not null default CURRENT_TIMESTAMP,
  "quarantined_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_quarantine_job_payload_unique"
  ON "job_quarantine" ("job_name", "payload_hash");

CREATE TABLE IF NOT EXISTS "queue_circuit_state" (
  "queue_name" TEXT PRIMARY KEY,
  "success_count" INTEGER not null default 0,
  "failure_count" INTEGER not null default 0,
  "window_start" TEXT not null default CURRENT_TIMESTAMP,
  "paused_at" TEXT,
  "resume_at" TEXT
);

CREATE TABLE IF NOT EXISTS "job_idempotency" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "idempotency_key" TEXT not null,
  "job_name" TEXT not null,
  "queue" TEXT not null default 'default',
  "dispatched_at" TEXT not null default CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "job_idempotency_key_unique"
  ON "job_idempotency" ("idempotency_key");

CREATE INDEX IF NOT EXISTS "jobs_queue_availability_index"
  ON "jobs" ("queue", "reserved_at", "available_at");
CREATE INDEX IF NOT EXISTS "dead_letter_jobs_queue_index"
  ON "dead_letter_jobs" ("queue", "dead_lettered_at");
