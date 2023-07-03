import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/collections',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/validation',
  ],

  clean: false,
  declaration: true,
})
