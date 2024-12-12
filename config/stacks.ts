import type { Registry } from '@stacksjs/registry'

/**
 * **Stacks**
 *
 * This configuration defines all of your "stacks." Because the framework is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default [
  {
    name: 'my-stack',
    url: 'stacksjs.org',
    github: 'stacksjs/my-stack',
  },
  // 'stacksjs' // works as well
] satisfies Registry
