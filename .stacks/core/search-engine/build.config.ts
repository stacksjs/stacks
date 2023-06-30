import { alias, defineBuildConfig } from '@stacksjs/development'

export default defineBuildConfig({
  alias,

  entries: [
    './src/index',
  ],

  externals: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/ui',
    'meilisearch',
  ],

  declaration: true,
  clean: true,
})
