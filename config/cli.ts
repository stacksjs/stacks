import { defineCliConfig, env } from 'stacks/core/config/src'

/**
 * **CLI Configuration**
 *
 * This configuration defines all of your CLI options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineCliConfig({
  name: env('CLI_NAME', 'stx'),
  command: env('CLI_COMMAND', 'stx'),
})
