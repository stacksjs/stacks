UPDATE "products"
SET "image_url" = 'https://picsum.photos/seed/product-' || CAST("id" AS TEXT) || '/640/480'
WHERE "image_url" LIKE 'https://via.placeholder.com/%';

UPDATE "payment_products"
SET "image" = 'https://picsum.photos/seed/payment-product-' || CAST("id" AS TEXT) || '/640/480'
WHERE "image" LIKE 'https://via.placeholder.com/%';

UPDATE "social_posts"
SET "image_url" = 'https://picsum.photos/seed/social-post-' || CAST("id" AS TEXT) || '/640/480'
WHERE "image_url" LIKE 'https://via.placeholder.com/%';

UPDATE "cart_items"
SET "product_image" = 'https://picsum.photos/seed/cart-item-' || CAST("id" AS TEXT) || '/640/480'
WHERE "product_image" LIKE 'https://via.placeholder.com/%';

UPDATE "posts"
SET "poster" = 'https://picsum.photos/seed/post-' || CAST("id" AS TEXT) || '/640/480'
WHERE "poster" LIKE 'https://via.placeholder.com/%';

UPDATE "loyalty_rewards"
SET "image_url" = 'https://picsum.photos/seed/loyalty-reward-' || CAST("id" AS TEXT) || '/640/480'
WHERE "image_url" LIKE 'https://via.placeholder.com/%';

UPDATE "categories"
SET "image_url" = 'https://picsum.photos/seed/category-' || CAST("id" AS TEXT) || '/640/480'
WHERE "image_url" LIKE 'https://via.placeholder.com/%';
