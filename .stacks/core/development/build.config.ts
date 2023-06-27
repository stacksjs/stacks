import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/alias',
    '@stacksjs/logging',
    'unbuild',
  ],

  rollup: {
    inlineDependencies: true,
  },

  clean: false,
  declaration: true,
})
