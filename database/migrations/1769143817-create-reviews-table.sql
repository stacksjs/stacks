CREATE TABLE IF NOT EXISTS "reviews" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "rating" REAL,
  "title" TEXT,
  "content" TEXT,
  "is_verified_purchase" INTEGER,
  "is_approved" INTEGER,
  "is_featured" INTEGER,
  "helpful_votes" REAL default 0,
  "unhelpful_votes" REAL default 0,
  "purchase_date" TEXT,
  "images" TEXT,
  "product_id" INTEGER,
  "customer_id" INTEGER,
  "uuid" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);