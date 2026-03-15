CREATE TABLE IF NOT EXISTS `transactions` (
  `id` bigint PRIMARY KEY auto_increment,
  `amount` real,
  `status` varchar(255),
  `payment_method` varchar(255),
  `payment_details` varchar(255),
  `transaction_reference` varchar(255),
  `loyalty_points_earned` real,
  `loyalty_points_redeemed` real,
  `order_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);