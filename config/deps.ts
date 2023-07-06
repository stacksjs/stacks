import { defineDependencies } from '@stacksjs/utils'

/**
 * **Dependency Manager**
 *
 * This configuration defines all of your dependencies. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @note This configuration is responsible for generating `./tea.yaml`
 */
export default defineDependencies({
  'nodejs.org': '18.16.1',
  'npmjs.com': '9.7.2',
  'pnpm.io': '8.6.5',
  'sqlite.org': '3.42.0', //  you may also yse 'mysql.org': '8.0.33' and/or 'mariadb.org': '10.6.5' and/or 'postgresql.org': '14.1'
  'redis.io': '7.0.11',
  'aws.amazon.com/cli': '2.12.7',
})
