CREATE TABLE IF NOT EXISTS `waitlist_products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `email` varchar(255),
  `phone` varchar(255),
  `quantity` real,
  `notification_preference` text,
  `source` varchar(255),
  `notes` text,
  `status` text default 'waiting',
  `notified_at` date,
  `purchased_at` date,
  `cancelled_at` date,
  `product_id` bigint,
  `customer_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);