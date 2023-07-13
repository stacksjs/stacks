import { defineBuildConfig, entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

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
