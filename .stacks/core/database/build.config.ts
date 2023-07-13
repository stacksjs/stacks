import { defineBuildConfig, entries } from '@stacksjs/development'
import { alias } from '@stacksjs/alias'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/storage',
  ],

  declaration: true,
  clean: false,
})
