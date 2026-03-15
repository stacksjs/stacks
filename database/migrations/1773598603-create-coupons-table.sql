CREATE TABLE IF NOT EXISTS `coupons` (
  `id` bigint PRIMARY KEY auto_increment,
  `code` varchar(255),
  `description` varchar(255),
  `status` ENUM('Active', 'Scheduled', 'Expired'),
  `is_active` tinyint(1),
  `discount_type` ENUM('fixed_amount', 'percentage'),
  `discount_value` real,
  `min_order_amount` real,
  `max_discount_amount` real,
  `free_product_id` varchar(255),
  `usage_limit` real,
  `usage_count` real,
  `start_date` date,
  `end_date` date,
  `product_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);