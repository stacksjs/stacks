CREATE TABLE IF NOT EXISTS `loyalty_points` (
  `id` bigint PRIMARY KEY auto_increment,
  `wallet_id` varchar(255),
  `points` real,
  `source` varchar(255),
  `source_reference_id` varchar(255),
  `description` varchar(255),
  `expiry_date` datetime,
  `is_used` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);