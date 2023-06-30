import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/arrays',
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/development',
    '@stacksjs/lint',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/strings',
    '@stacksjs/types',
    '@vueuse/core',
    '@vueuse/head',
    '@vueuse/math',
    '@vueuse/shared',
    'defu',
    'dinero.js',
    'fast-glob',
    'kolorist',
    'p-limit',
    'rimraf',
    'semver',
    'yaml',
  ],

  clean: false, // logging, alias, development, storage, and path are all prerequisites for other packages—needed for the release process
  declaration: true,
})
