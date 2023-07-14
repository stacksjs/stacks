import { alias } from '@stacksjs/alias'
import { defineBuildConfig, withCjsEntries as entries } from '@stacksjs/development'

// this is just the config to build the stacks/config
// so users could do
// import { app } from '@stacksjs/config'

// app.url === 'https://stacks.test' or whatever set in env
// let me show you now the auto-imports stuff

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    'stacks',
    'vite-ssg',
    'unplugin-vue-components',
    'execa',
    'unplugin-auto-import',
    'ora',
    'cac',
    'vite-plugin-inspect',
    'vite-plugin-pwa',
    'vite',
    'vue',
    '@vinejs/vine',
    'meilisearch',
    'vitepress',
    'neverthrow',
    '@novu/stateless',
    'collect.js',
    '@faker-js/faker',
    'stacks/vite',
    'stacks/utils',
    'stacks/ui',
    'unbuild',
    'changelogen',
    'node-ray',
    'stacks/lint',
    '@types/eslint',
    'unocss',
    '@vueuse/math',
    '@vueuse/core',
    '@stacksjs/lint',
  ],

  rollup: {
    alias,
  },

  declaration: true,
  clean: true,
})
