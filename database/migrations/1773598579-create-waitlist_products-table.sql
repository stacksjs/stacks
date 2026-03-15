CREATE TABLE IF NOT EXISTS `waitlist_products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `email` varchar(255),
  `phone` varchar(255),
  `quantity` real,
  `notification_preference` ENUM('sms', 'email', 'both'),
  `source` varchar(255),
  `notes` text,
  `status` ENUM('waiting', 'purchased', 'notified', 'cancelled') default 'waiting',
  `notified_at` date,
  `purchased_at` date,
  `cancelled_at` date,
  `product_id` bigint,
  `customer_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);