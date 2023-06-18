import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@vinejs/vine',
    '@vinejs/vine/build/src/types',
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
  declaration: true,
})
