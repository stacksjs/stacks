CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` bigint PRIMARY KEY auto_increment,
  `connection` varchar(255),
  `queue` varchar(255),
  `payload` varchar(255),
  `exception` varchar(255),
  `failed_at` date,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);