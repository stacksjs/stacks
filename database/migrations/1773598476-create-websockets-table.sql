CREATE TABLE IF NOT EXISTS `websockets` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` text,
  `socket` varchar(255),
  `details` text,
  `time` real,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);