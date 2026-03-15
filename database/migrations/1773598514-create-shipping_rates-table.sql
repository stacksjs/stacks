CREATE TABLE IF NOT EXISTS `shipping_rates` (
  `id` bigint PRIMARY KEY auto_increment,
  `weight_from` real,
  `weight_to` real,
  `rate` real,
  `shipping_method_id` bigint,
  `shipping_zone_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);