import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@vinejs/vine',
    'vite',
    'validator',
    '@stacksjs/path',
    '@stacksjs/utils',
    '@stacksjs/types',
  ],

  rollup: {
    inlineDependencies: true,
  },

  clean: true,
  declaration: false, // todo: this should be set to true
})
