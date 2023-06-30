import { alias, defineBuildConfig } from './src'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  // externals: [
  // '@stacksjs/alias',
  // '@stacksjs/logging',
  // '@stacksjs/testing',
  // '@stacksjs/tinker',
  // '@stacksjs/types',
  // 'unbuild',
  // ],

  rollup: {
    inlineDependencies: true,
  },

  clean: false, // logging, alias, development, storage, tinker, and path are all prerequisites for other packages—needed for the release process
  declaration: true,
})
