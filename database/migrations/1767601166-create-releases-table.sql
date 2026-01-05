CREATE TABLE IF NOT EXISTS `releases` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `version` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);