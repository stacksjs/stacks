CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` bigint PRIMARY KEY auto_increment,
  `type` text,
  `last_four` real,
  `brand` varchar(255),
  `exp_month` real,
  `exp_year` real,
  `is_default` tinyint(1),
  `provider_id` varchar(255),
  `user_id` bigint
);