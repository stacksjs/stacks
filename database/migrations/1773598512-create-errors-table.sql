CREATE TABLE IF NOT EXISTS `errors` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` varchar(255),
  `message` varchar(255),
  `stack` varchar(255),
  `status` real,
  `additional_info` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);