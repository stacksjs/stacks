CREATE TABLE IF NOT EXISTS `pages` (
  `id` bigint PRIMARY KEY auto_increment,
  `title` varchar(255),
  `template` varchar(255),
  `views` real default 0,
  `published_at` datetime,
  `conversions` real default 0,
  `author_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);