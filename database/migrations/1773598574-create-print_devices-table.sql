CREATE TABLE IF NOT EXISTS `print_devices` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `mac_address` varchar(255),
  `location` varchar(255),
  `terminal` varchar(255),
  `status` ENUM('online', 'offline', 'warning'),
  `last_ping` varchar(255),
  `print_count` real,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);