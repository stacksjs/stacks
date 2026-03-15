CREATE TABLE IF NOT EXISTS `authors` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `email` varchar(255),
  `user_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);