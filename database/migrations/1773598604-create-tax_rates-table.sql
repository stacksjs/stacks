CREATE TABLE IF NOT EXISTS `tax_rates` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `rate` real,
  `type` varchar(255),
  `country` varchar(255),
  `region` ENUM('North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica'),
  `status` ENUM('active', 'inactive') default 'active',
  `is_default` tinyint(1) default 0,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);