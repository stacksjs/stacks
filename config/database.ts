import { defineDatabase, env } from '@stacksjs/utils'

/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDatabase({
  driver: 'mysql',

  drivers: {
    mysql: {
      name: env('DATABASE_NAME', ''),
      host: env('DATABASE_HOST', ''),
      url: env('DATABASE_URL', 'localhost'),
      port: env('DATABASE_PORT', 3306),
      username: env('DATABASE_USERNAME', ''),
      password: env('DATABASE_PASSWORD', ''),
    },

    planetscale: {},
    
    postgres: {},
  }
})
