import { defineDatabaseConfig, env } from 'stacks/core/config/src'

/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDatabaseConfig({
  driver: 'mysql',
  url: env('DATABASE_URL', ''),
  host: 'localhost',
  port: 3306,
  database: env('DATABASE_NAME', ''),
  username: env('DATABASE_USERNAME', ''),
  password: env('DATABASE_PASSWORD', ''),
})
