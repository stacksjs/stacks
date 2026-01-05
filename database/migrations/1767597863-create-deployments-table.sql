CREATE TABLE IF NOT EXISTS `deployments` (
  `id` bigint PRIMARY KEY auto_increment,
  `commit_sha` varchar(255),
  `commit_message` varchar(255),
  `branch` varchar(255),
  `status` varchar(255),
  `execution_time` real,
  `deploy_script` varchar(255),
  `terminal_output` varchar(255),
  `created_at` datetime not null default CURRENT_TIMESTAMP,
  `updated_at` datetime
);