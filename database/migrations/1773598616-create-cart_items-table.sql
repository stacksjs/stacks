CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` bigint PRIMARY KEY auto_increment,
  `quantity` real,
  `unit_price` real,
  `total_price` real,
  `tax_rate` real,
  `tax_amount` real,
  `discount_percentage` real,
  `discount_amount` real,
  `product_name` varchar(255),
  `product_sku` varchar(255),
  `product_image` varchar(255),
  `notes` text,
  `cart_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);