CREATE TABLE IF NOT EXISTS `payment_products` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` text,
  `description` varchar(255),
  `key` varchar(255),
  `unit_price` real,
  `status` varchar(255),
  `image` varchar(255),
  `provider_id` varchar(255)
);