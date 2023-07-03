import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/storage',
    '@stacksjs/cli',
    '@stacksjs/path',
    '@stacksjs/types',
  ],

  declaration: true,
  clean: false,
})
