CREATE TABLE IF NOT EXISTS `waitlist_restaurants` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `email` varchar(255),
  `phone` varchar(255),
  `party_size` real,
  `check_in_time` datetime,
  `table_preference` ENUM('indoor', 'bar', 'booth', 'no_preference'),
  `status` ENUM('waiting', 'seated', 'cancelled', 'no_show') default 'waiting',
  `quoted_wait_time` real,
  `actual_wait_time` real,
  `queue_position` real,
  `seated_at` datetime,
  `no_show_at` datetime,
  `cancelled_at` datetime,
  `customer_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);