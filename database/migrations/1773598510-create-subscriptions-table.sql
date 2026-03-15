CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` text,
  `plan` varchar(255),
  `provider_id` varchar(255),
  `provider_status` varchar(255),
  `unit_price` real,
  `provider_type` varchar(255),
  `provider_price_id` varchar(255),
  `quantity` real,
  `trial_ends_at` datetime,
  `ends_at` datetime,
  `last_used_at` datetime,
  `user_id` bigint
);