import { defineDatabaseConfig, env } from 'stacks/core/utils/src'

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
})
