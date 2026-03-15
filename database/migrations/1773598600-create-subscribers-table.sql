CREATE TABLE IF NOT EXISTS `subscribers` (
  `id` bigint PRIMARY KEY auto_increment,
  `email` varchar(255),
  `status` ENUM('subscribed', 'unsubscribed', 'pending', 'bounced') default 'subscribed',
  `source` varchar(255) default 'homepage',
  `user_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);