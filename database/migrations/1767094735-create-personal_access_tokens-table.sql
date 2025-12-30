CREATE TABLE `personal_access_tokens` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `token` varchar(255),
  `plain_text_token` varchar(255),
  `abilities` varchar(255),
  `last_used_at` datetime,
  `expires_at` datetime,
  `revoked_at` datetime,
  `ip_address` varchar(255),
  `device_name` varchar(255),
  `is_single_use` tinyint(1)
);