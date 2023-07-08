import { alias, defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@novu/stateless',
    '@stacksjs/storage',
    '@stacksjs/path',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/validation',
    '@vinejs/vine',
    'c12',
    'macroable',
    'cac',
    'consola',
    'execa',
    'kolorist',
    'meilisearch',
    'neverthrow',
    'node-ray',
    'ora',
    'pathe',
    'rimraf',
    'semver',
    'vite',
    'vite-plugin-inspect',
    'vite-plugin-pwa',
    'vite-ssg',
    'vite-plugin-vue-layouts',
    'vitepress',
    'vue',
    'unocss',
    'unplugin-auto-import',
    'unplugin-vue-components',
    'yaml',
  ],

  rollup: {
    alias,
    inlineDependencies: true,
  },

  declaration: true,
  clean: false,
})
