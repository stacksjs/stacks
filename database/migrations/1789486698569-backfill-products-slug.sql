-- #3005: products had no slug, so the storefront found none of them
--
-- Add to cart, checkout and reviews look a product up by slug, the cart keeps
-- it in cart_items.product_sku, and the product pages link /products/{slug}.
-- The column arrives two migrations back, nullable because SQLite cannot add
-- a NOT NULL column without a default. Every write path now sets it; this
-- gives the rows that already exist one.
--
-- The name, lowercased, with common punctuation dropped and spaces turned into
-- hyphens. SQLite has no regular expressions, so this is a fixed list rather
-- than a full slugify. A name that would collide with another product's slug
-- keeps its id as a suffix instead, so the unique index always holds.
CREATE TEMP TABLE "product_slug_candidates" AS
SELECT "id", REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LOWER(TRIM("name")), '''', ''), '"', ''), '&', ''), '/', ''), '?', ''), '#', ''), '%', ''), '.', ''), ',', ''), ':', ''), ';', ''), '(', ''), ')', ''), '!', ''), '+', ''), '*', ''), '=', ''), '@', ''), '[', ''), ']', ''), ' ', '-'), '--', '-'), '--', '-'), '--', '-') AS "candidate"
FROM "products"
WHERE "slug" IS NULL;

UPDATE "products"
SET "slug" = (SELECT "candidate" FROM "product_slug_candidates" AS "c" WHERE "c"."id" = "products"."id")
WHERE "id" IN (
  SELECT "c"."id" FROM "product_slug_candidates" AS "c"
  WHERE "c"."candidate" <> ''
    AND (SELECT COUNT(*) FROM "product_slug_candidates" AS "same" WHERE "same"."candidate" = "c"."candidate") = 1
    AND NOT EXISTS (SELECT 1 FROM "products" AS "taken" WHERE "taken"."slug" = "c"."candidate")
);

UPDATE "products"
SET "slug" = (
  SELECT CASE WHEN "c"."candidate" = '' THEN 'product-' || "products"."id" ELSE "c"."candidate" || '-' || "products"."id" END
  FROM "product_slug_candidates" AS "c"
  WHERE "c"."id" = "products"."id"
)
WHERE "slug" IS NULL;

DROP TABLE "product_slug_candidates";
