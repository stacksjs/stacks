import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/storage',
    '@stacksjs/cli',
    '@stacksjs/path',
    '@stacksjs/types',
  ],

  declaration: true,
  clean: false,
})
