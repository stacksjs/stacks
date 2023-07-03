import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/ui',
    'meilisearch',
  ],

  declaration: true,
  clean: false,
})
