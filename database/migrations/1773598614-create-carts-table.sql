CREATE TABLE IF NOT EXISTS `carts` (
  `id` bigint PRIMARY KEY auto_increment,
  `status` ENUM('active', 'abandoned', 'converted', 'expired') default 'active',
  `total_items` real default 0,
  `subtotal` real default 0,
  `tax_amount` real default 0,
  `discount_amount` real default 0,
  `total` real default 0,
  `expires_at` datetime,
  `currency` varchar(255) default 'USD',
  `notes` text,
  `applied_coupon_id` varchar(255),
  `customer_id` bigint,
  `coupon_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);