CREATE TABLE IF NOT EXISTS `license_keys` (
  `id` bigint PRIMARY KEY auto_increment,
  `key` varchar(255),
  `template` text,
  `expiry_date` datetime,
  `status` text default 'unassigned',
  `customer_id` bigint,
  `product_id` bigint,
  `order_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);