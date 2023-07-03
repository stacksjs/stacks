import { alias, defineBuildConfig, entries } from '@stacksjs/development'

export default defineBuildConfig({
  alias,
  entries,

  externals: [
    '@stacksjs/types',
    'vue-router',
  ],

  clean: false,
  declaration: true,
})
