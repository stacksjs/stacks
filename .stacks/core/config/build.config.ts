import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    'src/index',
  ],

  externals: [
    '@novu/stateless',
    '@stacksjs/storage',
    '@stacksjs/path',
    '@stacksjs/types',
    '@stacksjs/utils',
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
    inlineDependencies: true,
  },

  declaration: true,
  clean: true,
})
