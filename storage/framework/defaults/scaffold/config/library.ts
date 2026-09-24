import type { LibraryConfig } from '@stacksjs/types'

/**
 * **Library Configuration**
 *
 * This configuration defines all of your library options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  name: '__APP_SLUG__',
  // The npm scope your packages publish under, e.g. 'your-org'. Set it before
  // `buddy libs:publish`; the @ prefix is added automatically.
  owner: null,
  // `owner/name` on GitHub; fills in each package's repository, homepage and bugs links.
  repository: '',
  license: 'MIT',
  author: '',
  contributors: [],
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
      name: '__APP_SLUG__-fx',
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
      name: '__APP_SLUG__-components',
      kind: 'components',
      description: 'Your STX component library, as tree-shakeable modules.',
      keywords: ['components', 'custom-elements', 'stx', 'library', 'typescript'],
      prefix: '__APP_TAG_PREFIX__',
      include: ['*.stx'],
    },

    {
      name: '__APP_SLUG__-elements',
      kind: 'web-components',
      description: 'Your framework agnostic web component library description.',
      keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
      prefix: '__APP_TAG_PREFIX__',
      include: ['*.stx'],
    },
  ],
} satisfies LibraryConfig
