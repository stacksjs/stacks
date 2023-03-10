import { env } from '../.stacks/core/utils/src/helpers'
import { defineDatabaseConfig } from '../.stacks/core/config/src/helpers'

/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDatabaseConfig({
  driver: 'planetscale',
  url: env('DATABASE_URL', ''),
})
