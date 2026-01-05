CREATE TABLE IF NOT EXISTS `subscribers` (
  `id` bigint PRIMARY KEY auto_increment,
  `subscribed` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);