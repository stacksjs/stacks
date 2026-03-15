CREATE TABLE IF NOT EXISTS `jobs` (
  `id` bigint PRIMARY KEY auto_increment,
  `queue` varchar(255),
  `payload` varchar(255),
  `attempts` real,
  `available_at` real,
  `reserved_at` date,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);