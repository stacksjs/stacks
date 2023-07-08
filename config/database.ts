import { defineDatabase } from 'stacks/utils'
import { env } from 'stacks/validation'

/**
 * **Database Configuration**
 *
 * This configuration defines all of your database options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineDatabase({
  default: env.DB_CONNECTION || 'mysql',

  connections: {
    mysql: {
      url: env.DB_URL,
      name: env.DB_DATABASE || 'stacks',
      host: env.DB_HOST || '127.0.0.1',
      port: env.DB_PORT || 3306,
      username: env.DB_USERNAME || 'root',
      password: env.DB_PASSWORD || '',
      prefix: '',
    },

    sqlite: {
      url: env.DB_URL,
      database: env.DB_DATABASE || 'stacks',
      prefix: '',
    },

    planetscale: {},

    postgres: {},
  },

  migrations: 'migrations',
})
