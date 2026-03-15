CREATE TABLE IF NOT EXISTS `logs` (
  `id` bigint PRIMARY KEY auto_increment,
  `timestamp` real,
  `type` ENUM('warning', 'error', 'info', 'success'),
  `source` ENUM('file', 'cli', 'system'),
  `message` text,
  `project` varchar(255),
  `stacktrace` text,
  `file` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);