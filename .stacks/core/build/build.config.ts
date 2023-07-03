import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

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
  ],

  clean: false,
  declaration: true,
})
