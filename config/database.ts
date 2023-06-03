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
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      // url: env.DB_URL || 'localhost',
      port: env.DB_PORT || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
    },

    planetscale: {},

    postgres: {},
  },
})
