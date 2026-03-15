CREATE TABLE IF NOT EXISTS `digital_deliveries` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` varchar(255),
  `download_limit` real,
  `expiry_days` real,
  `requires_login` tinyint(1) default 0,
  `automatic_delivery` tinyint(1) default 0,
  `status` ENUM('active', 'inactive') default 'active',
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);