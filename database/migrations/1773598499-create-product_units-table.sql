CREATE TABLE IF NOT EXISTS `product_units` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `abbreviation` varchar(255),
  `type` varchar(255),
  `description` varchar(255),
  `is_default` tinyint(1),
  `product_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);