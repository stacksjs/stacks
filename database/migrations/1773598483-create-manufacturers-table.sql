CREATE TABLE IF NOT EXISTS `manufacturers` (
  `id` bigint PRIMARY KEY auto_increment,
  `manufacturer` varchar(255),
  `description` text,
  `country` varchar(255),
  `featured` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);