import type { LibraryConfig } from '@stacksjs/types'

/**
 * **Library Configuration**
 *
 * This configuration defines all of your library options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  name: 'hello-world',
  owner: '@stacksjs', // you may or may not add the @ prefix here (it is added automatically)
  repository: 'stacksjs/stacks',
  license: 'MIT',
  author: 'Chris Breuer',
  contributors: ['Chris Breuer <chris@stacksjs.com>'],
  defaultLanguage: 'en',
  releaseable: true,

  /**
   * One `resources/` tree, any number of npm packages.
   *
   * Each entry claims a slice of `resources/functions` or `resources/components`
   * by glob and becomes its own package: its own name, manifest, dist and
   * version. Slices may overlap, so a component can ship in a bundle package
   * and in a focused one. `buddy libs` prints what each package resolved to,
   * `buddy build:libs` builds them all, `buddy libs:publish` publishes them.
   */
  packages: [
    {
      name: 'hello-world-fx',
      kind: 'functions',
      description: 'Your function library description.',
      keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
      include: ['*.ts'],
      // These composables call stx's ambient globals (`state`, `useDark`),
      // which no module exports. Saying so here is what lets them ship: the
      // build otherwise refuses them, because a consumer importing the
      // published package would hit `ReferenceError: state is not defined`.
      runtime: 'stx',
    },

    {
      name: 'hello-world-components',
      kind: 'components',
      description: 'Your STX component library, as tree-shakeable modules.',
      keywords: ['components', 'custom-elements', 'stx', 'library', 'typescript'],
      prefix: 'stacks',
      include: ['*.stx'],
    },

    {
      name: 'hello-world-elements',
      kind: 'web-components',
      description: 'Your framework agnostic web component library description.',
      keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
      prefix: 'stacks',
      include: ['*.stx'],
    },
  ],
} satisfies LibraryConfig
