import { defineCli, env } from '@stacksjs/config'

/**
 * **CLI Configuration**
 *
 * This configuration defines all of your CLI options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineCli({
  name: env('CLI_NAME', 'stx'),
  command: env('CLI_COMMAND', 'stx'),
})
