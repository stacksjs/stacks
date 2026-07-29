CREATE TABLE IF NOT EXISTS "order_idempotency" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "idempotency_key" TEXT not null,
  "order_id" INTEGER not null REFERENCES "orders"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "order_idempotency_order_idempotency_idempotency_key_unique" ON "order_idempotency" ("idempotency_key");
