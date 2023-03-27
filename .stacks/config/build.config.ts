import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    './src/index',
  ],
  declaration: true,
  clean: true,
  externals: [
    '@stacksjs/utils',
    '@stacksjs/path',
    '@stacksjs/types',
    'node:http',
    'vite',
    'vitepress',
    'zod',
    'cac',
    'ora',
    'execa',
    'neverthrow',
    'unimport',
    'vite-plugin-inspect',
    'vite-ssg',
    'vite-plugin-vue-layouts',
    '@antfu/utils',
    'unplugin-vue-components',
    'unplugin-auto-import',
  ],

  rollup: {
    inlineDependencies: true,
  },
})
