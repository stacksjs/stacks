import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/alias',
    '@stacksjs/config',
    '@stacksjs/path',
    '@stacksjs/server',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/development',
    'unocss',
    'unocss/vite',
    'defu',
    'vite-plugin-mkcert',
    'picocolors',
    'vite',
    'vitepress',
  ],

  clean: false,
  declaration: true,
})
