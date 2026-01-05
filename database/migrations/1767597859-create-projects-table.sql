CREATE TABLE IF NOT EXISTS `projects` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` varchar(255),
  `url` varchar(255),
  `status` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);