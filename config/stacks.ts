import type { StackExtensionRegistry } from '@stacksjs/types'

/**
 * **Stack Extensions**
 *
 * This configuration defines all of your stack extensions. Because the framework is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * @example
 * ```ts
 * export default [
 *   'blog',                                       // shorthand - resolves from pantry
 *   '@stacksjs/commerce',                         // scoped package shorthand
 *   { name: 'analytics', github: 'stacksjs/analytics-stack' },  // full entry
 * ] satisfies StackExtensionRegistry
 * ```
 */
export default [
  {
    name: 'my-stack',
    url: 'stacksjs.com',
    github: 'stacksjs/my-stack',
  },
  // 'blog' // string shorthand works as well
] satisfies StackExtensionRegistry
