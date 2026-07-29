WITH duplicate_names AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS duplicate_rank
    FROM tags
  )
  WHERE duplicate_rank > 1
)
UPDATE tags
SET name = SUBSTR(name, 1, 40) || '-' || id
WHERE id IN (SELECT id FROM duplicate_names);

WITH duplicate_slugs AS (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS duplicate_rank
    FROM tags
  )
  WHERE duplicate_rank > 1
)
UPDATE tags
SET slug = SUBSTR(slug, 1, 40) || '-' || id
WHERE id IN (SELECT id FROM duplicate_slugs);

UPDATE coupons
SET is_active = 1
WHERE is_active IS NULL;

UPDATE authors
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = authors.user_id
  );

UPDATE notification_deliveries
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = notification_deliveries.user_id
  );
