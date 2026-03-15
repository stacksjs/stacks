CREATE TABLE IF NOT EXISTS `shipping_methods` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` text,
  `base_rate` real,
  `free_shipping` real,
  `status` ENUM('active', 'inactive', 'draft'),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);