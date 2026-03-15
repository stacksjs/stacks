CREATE TABLE IF NOT EXISTS `customers` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `email` varchar(255),
  `phone` varchar(255),
  `total_spent` real default 0,
  `last_order` varchar(255),
  `status` text default 'Active',
  `avatar` varchar(255),
  `user_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);