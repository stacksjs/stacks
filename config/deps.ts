import { defineDependencies } from '../.stacks/core/config/src/helpers'

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
  'bun.sh': '0.7.1',
  'sqlite.org': '3.42.0', //  you may also yse 'mysql.org': '8.0.33', 'mariadb.org': '10.6.5' and/or 'postgresql.org': '14.1'
  'redis.io': '7.0.11',
  'aws.amazon.com/cli': '2.12.7',
})
