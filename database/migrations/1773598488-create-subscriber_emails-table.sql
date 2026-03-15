CREATE TABLE IF NOT EXISTS `subscriber_emails` (
  `id` bigint PRIMARY KEY auto_increment,
  `email` varchar(255),
  `source` varchar(255) default 'homepage',
  `subscriber_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);