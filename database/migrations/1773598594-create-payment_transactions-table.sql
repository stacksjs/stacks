CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` varchar(255),
  `amount` real,
  `type` varchar(255),
  `provider_id` varchar(255),
  `user_id` bigint,
  `payment_method_id` bigint
);