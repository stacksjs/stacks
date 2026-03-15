CREATE TABLE IF NOT EXISTS `payments` (
  `id` bigint PRIMARY KEY auto_increment,
  `amount` real,
  `method` varchar(255),
  `status` varchar(255),
  `currency` varchar(255),
  `reference_number` varchar(255),
  `card_last_four` varchar(255),
  `card_brand` varchar(255),
  `billing_email` varchar(255),
  `transaction_id` varchar(255),
  `payment_provider` varchar(255),
  `refund_amount` real,
  `notes` varchar(255),
  `order_id` bigint,
  `customer_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);