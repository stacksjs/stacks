CREATE TABLE IF NOT EXISTS `orders` (
  `id` bigint PRIMARY KEY auto_increment,
  `status` varchar(255),
  `total_amount` real,
  `tax_amount` real,
  `discount_amount` real,
  `delivery_fee` real,
  `tip_amount` real,
  `order_type` varchar(255),
  `delivery_address` varchar(255),
  `special_instructions` varchar(255),
  `estimated_delivery_time` varchar(255),
  `applied_coupon_id` varchar(255),
  `customer_id` bigint,
  `coupon_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);