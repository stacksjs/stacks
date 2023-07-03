import { alias, defineBuildConfig, entries } from '@stacksjs/development'

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
