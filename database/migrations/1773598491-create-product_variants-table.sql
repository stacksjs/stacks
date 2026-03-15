CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` bigint PRIMARY KEY auto_increment,
  `variant` varchar(255),
  `type` varchar(255),
  `description` varchar(255),
  `options` varchar(255),
  `status` text,
  `product_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);