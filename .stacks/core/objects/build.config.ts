import { defineBuildConfig, entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/collections',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/validation',
  ],

  clean: false,
  declaration: true,
})
