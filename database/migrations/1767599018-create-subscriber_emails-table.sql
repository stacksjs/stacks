CREATE TABLE IF NOT EXISTS `subscriber_emails` (
  `id` bigint PRIMARY KEY auto_increment,
  `email` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime,
  `deleted_at` datetime
);