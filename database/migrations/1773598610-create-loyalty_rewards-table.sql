CREATE TABLE IF NOT EXISTS `loyalty_rewards` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` text,
  `points_required` real,
  `reward_type` varchar(255),
  `discount_percentage` real,
  `free_product_id` varchar(255),
  `is_active` tinyint(1),
  `expiry_days` real,
  `image_url` varchar(255),
  `product_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);