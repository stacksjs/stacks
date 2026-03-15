CREATE TABLE IF NOT EXISTS `receipts` (
  `id` bigint PRIMARY KEY auto_increment,
  `printer` varchar(255),
  `document` varchar(255),
  `timestamp` datetime,
  `status` ENUM('success', 'failed', 'warning'),
  `size` real,
  `pages` real,
  `duration` real,
  `metadata` varchar(255),
  `print_device_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);