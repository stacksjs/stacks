CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint PRIMARY KEY auto_increment,
  `quantity` real default 1,
  `price` real,
  `special_instructions` varchar(255),
  `order_id` bigint,
  `product_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);