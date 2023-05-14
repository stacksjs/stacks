import { defineCli, env } from '@stacksjs/utils'

/**
 * **CLI Configuration**
 *
 * This configuration defines all of your CLI options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineCli({
  name: env('CLI_NAME', 'Stacks CLI'),
  command: env('CLI_COMMAND', 'stx'),
  description: 'This is an example command to illustrate how to create your own commands. Check out `../app/cli` for more.',
})
