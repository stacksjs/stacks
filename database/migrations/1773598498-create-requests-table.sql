CREATE TABLE IF NOT EXISTS `requests` (
  `id` bigint PRIMARY KEY auto_increment,
  `method` text,
  `path` varchar(255),
  `status_code` real,
  `duration_ms` real,
  `ip_address` varchar(255),
  `memory_usage` real,
  `user_agent` varchar(255),
  `error_message` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `deleted_at` datetime
);