CREATE TABLE IF NOT EXISTS `drivers` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `phone` varchar(255),
  `vehicle_number` varchar(255),
  `license` varchar(255),
  `status` text default 'active',
  `user_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);