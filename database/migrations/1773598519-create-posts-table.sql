CREATE TABLE IF NOT EXISTS `posts` (
  `id` bigint PRIMARY KEY auto_increment,
  `title` varchar(255),
  `poster` varchar(255),
  `content` text,
  `excerpt` text,
  `views` real default 0,
  `published_at` datetime,
  `status` text default 'draft',
  `is_featured` real,
  `author_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);