CREATE TABLE IF NOT EXISTS `shipping_zones` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `countries` text,
  `regions` text,
  `postal_codes` text,
  `status` text,
  `shipping_method_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);