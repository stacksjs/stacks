CREATE TABLE IF NOT EXISTS `categories` (
  `id` bigint PRIMARY KEY auto_increment,
  `name` varchar(255),
  `description` varchar(255),
  `slug` varchar(255),
  `image_url` varchar(255),
  `is_active` tinyint(1),
  `parent_category_id` varchar(255),
  `display_order` real,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);