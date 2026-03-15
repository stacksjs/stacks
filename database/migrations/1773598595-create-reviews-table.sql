CREATE TABLE IF NOT EXISTS `reviews` (
  `id` bigint PRIMARY KEY auto_increment,
  `rating` real,
  `title` varchar(255),
  `content` text,
  `is_verified_purchase` tinyint(1),
  `is_approved` tinyint(1),
  `is_featured` tinyint(1),
  `helpful_votes` real default 0,
  `unhelpful_votes` real default 0,
  `purchase_date` varchar(255),
  `images` varchar(255),
  `product_id` bigint,
  `customer_id` bigint,
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);