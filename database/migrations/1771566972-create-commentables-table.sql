CREATE TABLE IF NOT EXISTS "commentables" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT DEFAULT 'pending',
  "commentables_id" INTEGER,
  "commentables_type" TEXT,
  "user_id" INTEGER,
  "is_active" INTEGER DEFAULT 1,
  "approved_at" TEXT,
  "rejected_at" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
