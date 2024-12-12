import type { BinaryConfig } from '@stacksjs/types'

/**
 * **Binary / CLI Configuration**
 *
 * This configuration defines all of your Binary/CLI options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  name: 'My Custom CLI',
  command: 'custom-cli', // enables `custom-cli <command> <options>`
  description:
    'This is an example command to illustrate how to create your own commands. Check out `../app/commands` for more.',
  deploy: true, // deploys CLI setup endpoint (./bootstrap)
} satisfies BinaryConfig
