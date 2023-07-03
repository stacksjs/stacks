import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/storage',
  ],

  declaration: true,
  clean: false,
})
