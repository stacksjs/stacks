import { defineBuildConfig, entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

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
