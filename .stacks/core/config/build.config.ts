import { defineBuildConfig } from 'unbuild'
import { alias } from '@stacksjs/alias'

// eslint-disable-next-line no-console
console.log('here')

export default defineBuildConfig({
  alias,
  entries: [
    'src/index',
  ],
  externals: [
    '@types/markdown-it',
    '@mdit-vue/types',
    '@novu/stateless',
    'meilisearch',
    'unocss',
    '@mdit-vue/plugin-frontmatter',
    'vite-plugin-pwa',
    'zod',
    '@rollup/pluginutils',
    '@mdit-vue/plugin-component',
    'vitepress',
    'vite-plugin-vue-layouts',
    'cac',
    'vite-plugin-inspect',
    'neverthrow',
    'execa',
    'unplugin-vue-components',
    'ora',
    'vite',
    'vite-ssg',
    'vue',
    'unplugin-auto-import',
    'unbuild',
    'fsevents',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: false,
    inlineDependencies: false,
  },
})
