CREATE TABLE IF NOT EXISTS `teams` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `company_name` varchar(255),
  `email` varchar(255),
  `billing_email` varchar(255),
  `status` varchar(255),
  `description` varchar(255),
  `path` varchar(255),
  `is_personal` tinyint(1),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);