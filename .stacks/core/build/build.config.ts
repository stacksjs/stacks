import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
    {
      builder: 'mkdist',
      input: './src/',
      outDir: './dist/',
      format: 'esm',
    },
  ],

  externals: [
    '@stacksjs/alias',
    '@stacksjs/config',
    '@stacksjs/path',
    '@stacksjs/server',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/development',
    '@vitejs/plugin-vue',
    'markdown-it-link-attributes',
    'markdown-it-shiki',
    'unbuild',
    'unplugin-auto-import',
    'unplugin-vue-components',
    'vite',
    'vite-plugin-inspect',
    'vite-plugin-pages',
    'vite-plugin-pwa',
    'vite-plugin-vue-layouts',
    'vite-plugin-vue-markdown',
    'vite-ssg',
    'vite-ssg-sitemap',
    'vue-docgen-web-types',
    'chokidar',
    'fs',
  ],

  rollup: {
    inlineDependencies: true,
  },

  clean: true,
  declaration: true,
})
