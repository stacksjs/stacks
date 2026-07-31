ALTER TABLE "failed_jobs" ADD COLUMN "attempts" INTEGER;
ALTER TABLE "failed_jobs" ADD COLUMN "max_attempts" INTEGER;
ALTER TABLE "failed_jobs" ADD COLUMN "duration_ms" INTEGER;
ALTER TABLE "failed_jobs" ADD COLUMN "uuid" TEXT;
