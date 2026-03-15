CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` varchar(255),
  `price` real,
  `image_url` varchar(255),
  `is_available` tinyint(1),
  `inventory_count` real,
  `preparation_time` real,
  `allergens` varchar(255),
  `nutritional_info` varchar(255),
  `category_id` bigint,
  `manufacturer_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);