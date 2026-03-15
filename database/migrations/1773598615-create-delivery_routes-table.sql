CREATE TABLE IF NOT EXISTS `delivery_routes` (
  `id` bigint PRIMARY KEY auto_increment,
  `driver` varchar(255),
  `vehicle` varchar(255),
  `stops` real,
  `delivery_time` real,
  `total_distance` real,
  `last_active` datetime,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);