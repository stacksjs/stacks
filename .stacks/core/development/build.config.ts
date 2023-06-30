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

  clean: true,
  declaration: true,
})
