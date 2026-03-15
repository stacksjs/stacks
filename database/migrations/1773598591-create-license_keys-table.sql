CREATE TABLE IF NOT EXISTS `license_keys` (
  `id` bigint PRIMARY KEY auto_increment,
  `key` varchar(255),
  `template` ENUM('Standard License', 'Premium License', 'Enterprise License'),
  `expiry_date` datetime,
  `status` ENUM('active', 'inactive', 'unassigned') default 'unassigned',
  `customer_id` bigint,
  `product_id` bigint,
  `order_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);