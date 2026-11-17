CREATE TABLE `examples` (
  `id` text NOT NULL,
  `user_id` text NOT NULL,
  `data` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `id`)
);
